-- Add missing DELETE policies for signals and nuggets tables
-- These policies allow users to delete their own records

-- RLS Policy for deleting signals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'signals'
    AND policyname = 'Users can delete own signals'
  ) THEN
    CREATE POLICY "Users can delete own signals"
      ON signals FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS Policy for deleting nuggets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nuggets'
    AND policyname = 'Users can delete own nuggets'
  ) THEN
    CREATE POLICY "Users can delete own nuggets"
      ON nuggets FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
