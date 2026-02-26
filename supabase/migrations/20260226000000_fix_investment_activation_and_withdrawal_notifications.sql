-- ============================================================
-- 1. Allow users to insert their own active investments
--    (needed for "Invest from Balance" flow in InvestFromBalanceModal)
-- ============================================================
CREATE POLICY "Users can insert own active investments"
ON public.active_investments
FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 2. Notify all admins when a new withdrawal request is submitted
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_uid UUID;
BEGIN
  FOR admin_uid IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  ) LOOP
    PERFORM public.create_system_notification(
      admin_uid,
      'New Withdrawal Request',
      format(
        'A withdrawal of $%s (%s) to wallet %s has been requested. Please review.',
        NEW.amount::numeric(10,2),
        NEW.crypto_type,
        substring(NEW.wallet_address, 1, 12) || '...'
      ),
      'info'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_withdrawal_requested ON public.withdrawals;
CREATE TRIGGER on_withdrawal_requested
  AFTER INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_withdrawal();
