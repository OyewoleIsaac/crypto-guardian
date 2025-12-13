-- Add proof_image_url to deposits table
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

-- Add investment plan to investments table
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'silver';

-- Create storage bucket for deposit proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('deposit-proofs', 'deposit-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own deposit proofs
CREATE POLICY "Users can upload deposit proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public viewing of deposit proofs
CREATE POLICY "Public can view deposit proofs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'deposit-proofs');

-- Allow users to update their own proofs
CREATE POLICY "Users can update own deposit proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own proofs  
CREATE POLICY "Users can delete own deposit proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);