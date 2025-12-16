-- ============================================================================
-- Add UPDATE policy to user_preferences table
-- This allows users to update their existing reactions efficiently
-- instead of requiring DELETE + INSERT operations
-- ============================================================================

-- Create UPDATE policy for user_preferences
-- Uses USING clause to verify user owns the record before update
-- Uses WITH CHECK to ensure user_id cannot be changed to another user
CREATE POLICY "Users can update their own preferences"
ON public.user_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);