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
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};

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
  // Relaxed constraints for Coolify migration:
  // - Removed ANTHROPIC/HELICONE (deprecated)
  // - Added GOOGLE_CREDENTIALS_JSON (new for Vertex on Coolify)
  // - Warnings only (status: degraded) so deployment doesn't fail hard
  const requiredEnvVars = [
    'AGENTMAIL_API_KEY',
    'NEXT_PUBLIC_POSTHOG_KEY',
    'NEXT_PUBLIC_POSTHOG_HOST',
  ];
  
  // Check for either file path or JSON content for Google Auth
  const hasGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_JSON;
  
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (!hasGoogleCreds) missingVars.push('GOOGLE_CREDENTIALS_JSON');

  checks.config = {
    status: missingVars.length === 0 ? 'ok' : 'error',
    ...(missingVars.length > 0 && { error: `Missing: ${missingVars.join(', ')}` }),
  };

  // Overall status
  // Only fail hard (503) if database is down. Config errors are degraded (200).
  const isHealthy = checks.database.status === 'ok';
  const isConfigOk = checks.config.status === 'ok';
  const totalLatency = Date.now() - start;

  const response = {
    status: isHealthy && isConfigOk ? 'healthy' : 'degraded',
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
