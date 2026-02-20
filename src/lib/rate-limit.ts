/**
 * Lightweight in-memory rate limiter for API routes.
 *
 * Per-instance (not distributed) — suitable for Vercel serverless.
 * Each function instance maintains its own window. This catches
 * abuse from single IPs/users without requiring Redis/external state.
 *
 * Supports both IP-based (public endpoints) and user-based (authed endpoints) limiting.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });
 *
 *   // IP-based (public endpoints)
 *   const ip = getClientIp(request);
 *   const result = limiter.check(ip);
 *
 *   // User-based (authed endpoints)
 *   const result = limiter.check(`user:${userId}`);
 *
 *   if (!result.allowed) {
 *     return new Response('Too Many Requests', {
 *       status: 429,
 *       headers: result.headers,
 *     });
 *   }
 */

interface RateLimitConfig {
  /** Max requests per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  headers: Record<string, string>;
}

export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent memory leaks (every 60s)
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = 60_000;

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  function check(key: string): RateLimitResult {
    cleanup();

    const now = Date.now();
    let entry = store.get(key);

    // Reset window if expired
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const allowed = entry.count <= config.maxRequests;
    const resetAt = entry.resetAt;

    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    };

    if (!allowed) {
      headers['Retry-After'] = String(Math.ceil((resetAt - now) / 1000));
    }

    return { allowed, remaining, resetAt, headers };
  }

  return { check };
}

/**
 * Extract client IP from request headers.
 * Works with Vercel (x-real-ip), Cloudflare (cf-connecting-ip),
 * and standard proxies.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Vercel sets x-real-ip to the actual client IP (cannot be spoofed)
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  // Cloudflare
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Fallback: last entry in x-forwarded-for (proxy-appended, harder to spoof)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[ips.length - 1];
  }

  return 'unknown';
}

/**
 * Helper to return a 429 response with rate limit headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...result.headers,
      },
    }
  );
}
