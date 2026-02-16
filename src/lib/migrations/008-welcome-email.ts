export const MIGRATION_008_SQL = `
ALTER TABLE email_preferences ADD COLUMN welcome_email_sent INTEGER NOT NULL DEFAULT 0;
`;
