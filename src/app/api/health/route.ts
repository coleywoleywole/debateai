import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and uptime services.
 * Returns service status with dependency checks.
 *
 * Response:
 *   200 — all systems operational
 *   503 — one or more dependencies down
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string; warning?: string }> = {};

  // Check D1 database
  try {
    const dbStart = Date.now();
    const result = await d1.query('SELECT 1 as ping', []);
    checks.database = {
      status: result.success ? 'ok' : 'error',
      latencyMs: Date.now() - dbStart,
    };
  } catch {
    checks.database = {
      status: 'error',
      error: 'Database unreachable',
    };
  }

  // Check required env vars (don't leak values)
  const criticalEnvVars: string[] = [
    'CLOUDFLARE_D1_DATABASE_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLERK_SECRET_KEY',
  ];

  // These are important but not strictly critical for basic health
  const optionalEnvVars = [
    'AGENTMAIL_API_KEY',
    'NEXT_PUBLIC_POSTHOG_KEY',
    'NEXT_PUBLIC_POSTHOG_HOST',
    'GOOGLE_CREDENTIALS_JSON',
  ];
  
  const missingCritical = criticalEnvVars.filter((v) => !process.env[v]);
  const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);

  checks.config = {
    status: missingCritical.length === 0 ? 'ok' : 'error',
    ...(missingCritical.length > 0 && { error: `Missing critical: ${missingCritical.join(', ')}` }),
    ...(missingOptional.length > 0 && { warning: `Missing optional: ${missingOptional.join(', ')}` }),
  };

  // Overall status
  const isHealthy = checks.database.status === 'ok' && checks.config.status === 'ok';

  const totalLatency = Date.now() - start;

  const response = {
    status: isHealthy && !checks.config.warning ? 'healthy' : 'degraded',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    latencyMs: totalLatency,
    checks,
  };

  return NextResponse.json(response, {
    // Return 200 unless DB is down, to prevent deployment rollbacks on missing optional config
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
