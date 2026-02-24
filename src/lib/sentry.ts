/**
 * Self-hosted error logging — replaces Sentry.
 *
 * Writes errors to the D1 `error_log` table and console.error.
 * Keeps the same export interface (captureError, setUser, addBreadcrumb)
 * so all existing callers continue to work without changes.
 */

// Lazy-import d1 to avoid circular dependency issues at module load time.
// The d1 module is only needed when we actually log an error.
function getD1() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { d1 } = require('@/lib/d1');
  return d1;
}

/** Per-request user context (set via setUser, consumed by captureError). */
let _currentUser: { id?: string; email?: string } | null = null;

/**
 * Capture an error with additional context.
 * Writes to D1 error_log table (fire-and-forget) and console.error.
 */
export function captureError(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
    level?: 'fatal' | 'error' | 'warning' | 'info';
    route?: string;
    action?: string;
    debateId?: string;
    [key: string]: unknown;
  }
) {
  const { tags, extra, user, level = 'error', route, action, debateId, ...rest } = context || {};

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Always log to console for Vercel/Coolify log aggregation
  console.error(`[${level.toUpperCase()}]`, errorMessage, {
    route: route || tags?.route || tags?.api_route,
    action,
    debateId,
    ...(extra || {}),
    ...(rest || {}),
  });

  // Build context JSON for the DB column
  const contextData = JSON.stringify({
    tags,
    extra,
    action,
    debateId,
    ...rest,
  });

  const resolvedRoute = route || tags?.route || tags?.api_route || undefined;
  const resolvedUserId = user?.id || _currentUser?.id || undefined;

  // Fire-and-forget write to D1 — never let logging errors crash the app
  try {
    const d1 = getD1();
    d1.query(
      `INSERT INTO error_log (level, route, message, stack, context, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [level, resolvedRoute || null, errorMessage, errorStack || null, contextData, resolvedUserId || null]
    ).catch(() => {
      // Silently swallow — if the error logger itself fails, we still have console output
    });
  } catch {
    // getD1() or query construction failed — ignore, console.error above is the fallback
  }
}

/**
 * Set user context for error tracking.
 * Call after authentication to associate errors with users.
 */
export function setUser(user: { id: string; email?: string } | null) {
  _currentUser = user;
}

/**
 * Add breadcrumb for debugging.
 * Currently a no-op — breadcrumbs are not persisted.
 * Retained to keep the export interface stable.
 */
export function addBreadcrumb(
  _message: string,
  _data?: Record<string, unknown>,
  _category?: string
) {
  // No-op for now. Could be extended to write to a breadcrumbs buffer
  // that gets flushed alongside the next captureError call.
}
