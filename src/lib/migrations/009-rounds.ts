export const MIGRATION_009_SQL = `
-- Migration to add rounds and status columns to debates table
ALTER TABLE debates ADD COLUMN current_round INTEGER DEFAULT 1;
ALTER TABLE debates ADD COLUMN total_rounds INTEGER DEFAULT 3;
ALTER TABLE debates ADD COLUMN status TEXT DEFAULT 'active'; -- 'active', 'voting', 'completed'
ALTER TABLE debates ADD COLUMN winner TEXT; -- 'user', 'ai', 'tie'
`;
