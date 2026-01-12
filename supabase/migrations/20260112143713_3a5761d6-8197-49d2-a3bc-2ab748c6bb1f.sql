-- Create withdrawals table for tracking withdrawal requests
CREATE TABLE public.withdrawals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    wallet_address TEXT NOT NULL,
    crypto_type TEXT NOT NULL DEFAULT 'USDT',
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT withdrawals_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can create withdrawal requests
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals"
ON public.withdrawals
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update withdrawals (approve/reject)
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster queries
CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);

-- Enable realtime for withdrawals
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;