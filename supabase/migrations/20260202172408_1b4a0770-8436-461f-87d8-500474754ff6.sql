-- Add network column to payment_methods table
ALTER TABLE public.payment_methods 
ADD COLUMN IF NOT EXISTS network text;

-- Update existing records with common network values
UPDATE public.payment_methods 
SET network = 'Bitcoin Mainnet' 
WHERE crypto_type = 'BTC' AND network IS NULL;

UPDATE public.payment_methods 
SET network = 'Ethereum Mainnet (ERC-20)' 
WHERE crypto_type = 'ETH' AND network IS NULL;

UPDATE public.payment_methods 
SET network = 'Tron Network (TRC-20)' 
WHERE crypto_type = 'USDT' AND network IS NULL;