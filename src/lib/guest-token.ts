/**
 * HMAC-signed guest tokens to prevent cookie forgery.
 *
 * Guest IDs are signed with a server secret so that clients cannot
 * forge arbitrary guest identities to bypass rate limits.
 *
 * Token format: `{uuid}.{signature}`
 *
 * Uses HMAC-SHA256 for cryptographic signing with constant-time comparison.
 */

import crypto from 'crypto';

const SECRET = process.env.GUEST_TOKEN_SECRET || process.env.ADMIN_SECRET || '';

if (!SECRET) {
  console.warn(
    '[guest-token] No GUEST_TOKEN_SECRET or ADMIN_SECRET configured. ' +
    'Guest tokens will use an empty key — set GUEST_TOKEN_SECRET in production.'
  );
}

function hmacSign(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex');
}

/**
 * Create a signed guest token from a UUID.
 */
export function signGuestId(uuid: string): string {
  const signature = hmacSign(uuid);
  return `${uuid}.${signature}`;
}

/**
 * Verify and extract the guest UUID from a signed token.
 * Returns the UUID if valid, null if forged/invalid.
 */
export function verifyGuestId(token: string): string | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;

  const uuid = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  if (!uuid || !signature) return null;

  const expected = hmacSign(uuid);

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (!crypto.timingSafeEqual(a, b)) return null;

  return uuid;
}
