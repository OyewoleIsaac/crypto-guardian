-- =============================================
-- INVESTMENT PLATFORM COMPREHENSIVE UPDATE
-- =============================================

-- 1. Create investment_plans table for admin-managed plans
CREATE TABLE public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  min_investment NUMERIC NOT NULL DEFAULT 100,
  max_investment NUMERIC,
  roi_percentage NUMERIC NOT NULL DEFAULT 5,
  duration_days INTEGER NOT NULL DEFAULT 30,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon_name TEXT DEFAULT 'medal',
  color_class TEXT DEFAULT 'from-slate-400 to-slate-500',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on investment_plans
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view active plans
CREATE POLICY "Anyone can view active plans"
ON public.investment_plans
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

-- Only admins can manage plans
CREATE POLICY "Admins can manage plans"
ON public.investment_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default plans
INSERT INTO public.investment_plans (name, description, min_investment, max_investment, roi_percentage, duration_days, features, icon_name, color_class, display_order) VALUES
('Silver', 'Perfect for beginners starting their investment journey', 100, 4999, 8, 30, ARRAY['Daily profit updates', 'Email support', 'Basic analytics'], 'medal', 'from-slate-400 to-slate-500', 1),
('Gold', 'For serious investors seeking higher returns', 5000, 19999, 15, 30, ARRAY['Real-time tracking', 'Priority support', 'Advanced analytics', 'Compound interest'], 'crown', 'from-amber-400 to-amber-600', 2),
('Diamond', 'VIP tier with maximum returns and exclusive benefits', 20000, NULL, 25, 30, ARRAY['VIP manager', '24/7 phone support', 'Premium analytics', 'Compound interest', 'Bonus rewards'], 'diamond', 'from-cyan-400 to-blue-500', 3);

-- 2. Create payment_methods table for admin-managed crypto wallets
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crypto_type TEXT NOT NULL UNIQUE,
  crypto_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  icon_class TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Everyone can view enabled payment methods
CREATE POLICY "Anyone can view enabled payment methods"
ON public.payment_methods
FOR SELECT
USING (is_enabled = true OR has_role(auth.uid(), 'admin'));

-- Only admins can manage payment methods
CREATE POLICY "Admins can manage payment methods"
ON public.payment_methods
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default payment methods
INSERT INTO public.payment_methods (crypto_type, crypto_name, wallet_address, icon_class) VALUES
('BTC', 'Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'crypto-btc'),
('USDT', 'Tether (TRC20)', 'TXWkP3jLBqRGojUih1ShzNyDaN5Csnebok', 'crypto-usdt'),
('ETH', 'Ethereum', '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD00', 'crypto-eth');

-- 3. Create active_investments table to track user investments with lock periods
CREATE TABLE public.active_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.investment_plans(id),
  principal_amount NUMERIC NOT NULL,
  total_roi_earned NUMERIC NOT NULL DEFAULT 0,
  claimed_roi NUMERIC NOT NULL DEFAULT 0,
  daily_roi NUMERIC NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  deposit_id UUID REFERENCES public.deposits(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on active_investments
ALTER TABLE public.active_investments ENABLE ROW LEVEL SECURITY;

-- Users can view own investments
CREATE POLICY "Users can view own active investments"
ON public.active_investments
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all investments
CREATE POLICY "Admins can view all active investments"
ON public.active_investments
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Only system/admin can insert investments (after deposit approval)
CREATE POLICY "Admins can manage active investments"
ON public.active_investments
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. Add new columns to deposits table
ALTER TABLE public.deposits 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.investment_plans(id),
ADD COLUMN IF NOT EXISTS usd_amount NUMERIC,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC;

-- 5. Add profile fields for avatars
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 6. Create trigger for updated_at on new tables
CREATE TRIGGER update_investment_plans_updated_at
  BEFORE UPDATE ON public.investment_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_active_investments_updated_at
  BEFORE UPDATE ON public.active_investments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Add index for faster queries
CREATE INDEX idx_active_investments_user_id ON public.active_investments(user_id);
CREATE INDEX idx_active_investments_status ON public.active_investments(status);
CREATE INDEX idx_deposits_plan_id ON public.deposits(plan_id);

-- 8. Add ETH icon class to index.css (handled in frontend)

-- 9. Enable realtime for active_investments
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_investments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_plans;