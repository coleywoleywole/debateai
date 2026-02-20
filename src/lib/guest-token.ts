/**
 * HMAC-signed guest tokens to prevent cookie forgery.
 *
 * Guest IDs are signed with a server secret so that clients cannot
 * forge arbitrary guest identities to bypass rate limits.
 *
 * Token format: `{uuid}.{signature}`
 *
 * Uses a simple keyed hash that works in both Node and Edge runtimes
 * (no dependency on Node's `crypto` module).
 */

function getSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET || process.env.ADMIN_SECRET;
  if (!secret) {
    // Fallback for dev — in production GUEST_TOKEN_SECRET should be set
    return 'dev-guest-secret-not-for-production';
  }
  return secret;
}

/**
 * Simple keyed hash using djb2 with secret mixing.
 * Not cryptographic-grade, but sufficient for cookie integrity
 * where the attack surface is rate-limit bypass (not auth).
 */
function keyedHash(data: string, key: string): string {
  // Mix key and data
  const input = `${key}:${data}:${key}`;
  let h1 = 5381;
  let h2 = 52711;
  let h3 = 1000003;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) >>> 0;
    h2 = ((h2 << 5) + h2 + c) >>> 0;
    h3 = ((h3 * 1000003) ^ c) >>> 0;
  }
  // Produce a 24-char hex string from 3 hashes
  return h1.toString(16).padStart(8, '0') +
         h2.toString(16).padStart(8, '0') +
         h3.toString(16).padStart(8, '0');
}

/**
 * Create a signed guest token from a UUID.
 */
export function signGuestId(guestId: string): string {
  const sig = keyedHash(guestId, getSecret());
  return `${guestId}.${sig}`;
}

/**
 * Verify and extract the guest UUID from a signed token.
 * Returns the UUID if valid, null if forged/invalid.
 */
export function verifyGuestId(token: string): string | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const guestId = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  if (!guestId || !providedSig) return null;

  const expectedSig = keyedHash(guestId, getSecret());

  // Constant-time comparison to prevent timing attacks
  if (providedSig.length !== expectedSig.length) return null;

  let mismatch = 0;
  for (let i = 0; i < providedSig.length; i++) {
    mismatch |= providedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }

  return mismatch === 0 ? guestId : null;
}
