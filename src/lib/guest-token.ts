/**
 * HMAC-signed guest tokens to prevent cookie forgery.
 *
 * Guest IDs are signed with a server secret so that clients cannot
 * forge arbitrary guest identities to bypass rate limits.
 *
 * Token format: `{uuid}.{signature}`
 *
 * Uses HMAC-SHA256 via Web Crypto API (works in both Node and Edge runtimes).
 */

const SECRET = process.env.GUEST_TOKEN_SECRET || process.env.ADMIN_SECRET || 'debateai-default-guest-secret';

if (!process.env.GUEST_TOKEN_SECRET && !process.env.ADMIN_SECRET) {
  console.warn(
    '[guest-token] No GUEST_TOKEN_SECRET or ADMIN_SECRET configured. ' +
    'Using fallback key — set GUEST_TOKEN_SECRET in production.'
  );
}

// Cache the CryptoKey so we don't re-import on every call
let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const encoder = new TextEncoder();
  cachedKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return cachedKey;
}

async function hmacSign(data: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(data));
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create a signed guest token from a UUID.
 */
export async function signGuestId(uuid: string): Promise<string> {
  const signature = await hmacSign(uuid);
  return `${uuid}.${signature}`;
}

/**
 * Verify and extract the guest UUID from a signed token.
 * Returns the UUID if valid, null if forged/invalid.
 */
export async function verifyGuestId(token: string): Promise<string | null> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;

  const uuid = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  if (!uuid || !signature) return null;

  const expected = await hmacSign(uuid);

  if (!timingSafeEqual(signature, expected)) return null;

  return uuid;
}
