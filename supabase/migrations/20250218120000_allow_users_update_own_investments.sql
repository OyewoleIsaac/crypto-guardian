-- Allow users to update their own investments row (e.g. when claiming ROI or principal+ROI).
-- Previously only admins could UPDATE; balance changes from claim flows were silently failing.
CREATE POLICY "Users can update own investments"
  ON public.investments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
