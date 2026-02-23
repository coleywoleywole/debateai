export const MIGRATION_011_SQL = `
  -- Add category column to debates table for topic categorization
  ALTER TABLE debates ADD COLUMN category TEXT;

  -- Index for filtering debates by category
  CREATE INDEX IF NOT EXISTS idx_debates_category ON debates(category);

  -- Compound index for category + created_at (browse/listing queries)
  CREATE INDEX IF NOT EXISTS idx_debates_category_created ON debates(category, created_at DESC);
`;
