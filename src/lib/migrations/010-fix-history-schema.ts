export const MIGRATION_010_SQL = `
  -- Fix missing score_data column if it doesn't exist (history page fix)
  -- We wrap in a try/catch equivalent by attempting the alter. 
  -- If column exists, D1 will return error but our migration runner continues.
  ALTER TABLE debates ADD COLUMN score_data TEXT;
`;
