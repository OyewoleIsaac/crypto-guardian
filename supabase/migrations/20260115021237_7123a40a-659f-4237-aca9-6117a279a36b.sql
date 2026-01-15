-- Fix 1: Make deposit-proofs bucket private and update RLS policies
UPDATE storage.buckets SET public = false WHERE id = 'deposit-proofs';

-- Drop the overly permissive public viewing policy
DROP POLICY IF EXISTS "Public can view deposit proofs" ON storage.objects;

-- Create proper owner + admin access policy for viewing
CREATE POLICY "Users and admins can view deposit proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deposit-proofs' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
);

-- Fix 2: Restrict notification inserts to admin users only (not anonymous public)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Only admins can insert notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix 3: Restrict audit_logs inserts - admins can insert, and users can log their own actions
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Admins can insert any audit logs, users can log their own actions
CREATE POLICY "Admins and users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix 4: Restrict referrals - only the referred user can record being referred
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;

-- Users can only record themselves as being referred
CREATE POLICY "Users can record being referred"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referred_id);

-- Create a database function for system-generated notifications (to be called via trigger)
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_metadata);
END;
$$;

-- Create a database function for system audit logs (to be called via trigger)
CREATE OR REPLACE FUNCTION public.create_system_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_performed_by UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, details, performed_by)
  VALUES (p_user_id, p_action, p_details, p_performed_by);
END;
$$;

-- Create trigger for automatic notifications on deposit status changes
CREATE OR REPLACE FUNCTION public.notify_deposit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' THEN
    v_title := 'Deposit Approved';
    v_message := format('Your deposit of $%s has been confirmed and added to your balance.', 
      COALESCE(NEW.usd_amount, NEW.amount)::numeric(10,2));
    v_type := 'deposit';
  ELSIF NEW.status = 'rejected' THEN
    v_title := 'Deposit Rejected';
    v_message := format('Your deposit of %s %s has been rejected. %s', 
      NEW.crypto_amount, NEW.crypto_type, 
      COALESCE('Reason: ' || NEW.admin_notes, 'Please contact support for more information.'));
    v_type := 'deposit';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM create_system_notification(NEW.user_id, v_title, v_message, v_type);
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_deposit_status_change ON deposits;
CREATE TRIGGER on_deposit_status_change
  AFTER UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION notify_deposit_status_change();

-- Create trigger for automatic notifications on withdrawal status changes
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    v_title := 'Withdrawal Approved';
    v_message := format('Your withdrawal of $%s has been approved and is being processed.', 
      NEW.amount::numeric(10,2));
    v_type := 'success';
  ELSIF NEW.status = 'rejected' THEN
    v_title := 'Withdrawal Rejected';
    v_message := format('Your withdrawal request of $%s has been rejected. %s', 
      NEW.amount::numeric(10,2),
      COALESCE('Reason: ' || NEW.admin_notes, ''));
    v_type := 'error';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM create_system_notification(NEW.user_id, v_title, v_message, v_type);
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_withdrawal_status_change ON withdrawals;
CREATE TRIGGER on_withdrawal_status_change
  AFTER UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION notify_withdrawal_status_change();

-- Create trigger for automatic audit logging on deposit confirmation
CREATE OR REPLACE FUNCTION public.audit_deposit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM create_system_audit_log(
    NEW.user_id,
    CASE 
      WHEN NEW.status = 'confirmed' THEN 'deposit_confirmed'
      WHEN NEW.status = 'rejected' THEN 'deposit_rejected'
      ELSE 'deposit_status_changed'
    END,
    jsonb_build_object(
      'deposit_id', NEW.id,
      'amount', COALESCE(NEW.usd_amount, NEW.amount),
      'crypto_type', NEW.crypto_type,
      'crypto_amount', NEW.crypto_amount,
      'admin_notes', NEW.admin_notes
    ),
    NEW.confirmed_by
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deposit_audit ON deposits;
CREATE TRIGGER on_deposit_audit
  AFTER UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION audit_deposit_status_change();

-- Create trigger for automatic audit logging on withdrawal processing
CREATE OR REPLACE FUNCTION public.audit_withdrawal_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM create_system_audit_log(
    NEW.user_id,
    'withdrawal_' || NEW.status,
    jsonb_build_object(
      'withdrawal_id', NEW.id,
      'amount', NEW.amount,
      'wallet_address', NEW.wallet_address,
      'crypto_type', NEW.crypto_type,
      'admin_notes', NEW.admin_notes
    ),
    NEW.processed_by
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_withdrawal_audit ON withdrawals;
CREATE TRIGGER on_withdrawal_audit
  AFTER UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION audit_withdrawal_status_change();