-- Allow users to update their own active_investments (e.g. when claiming ROI or marking completed).
-- Previously only admins could UPDATE; status never changed to 'completed', so cards stayed visible.
CREATE POLICY "Users can update own active investments"
  ON public.active_investments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
