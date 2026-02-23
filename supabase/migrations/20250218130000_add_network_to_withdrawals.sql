-- Add network column to withdrawals (must match deposit crypto network)
ALTER TABLE public.withdrawals 
  ADD COLUMN IF NOT EXISTS network TEXT;
