export const MIGRATION_012_SQL = `
  -- Error logging table for self-hosted error tracking (replaces Sentry)
  CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT DEFAULT 'error',
    route TEXT,
    message TEXT,
    stack TEXT,
    context TEXT,
    user_id TEXT,
    request_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_error_log_timestamp ON error_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_error_log_route ON error_log(route);
`;
