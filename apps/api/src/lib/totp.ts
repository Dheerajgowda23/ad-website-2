import { createHmac } from 'node:crypto';
import { base32Decode } from './crypto.js';

/**
 * RFC 6238 TOTP: HMAC-SHA1, 6 digits, 30-second step. The second factor for
 * every staff login. Implemented directly on node:crypto so the code path is
 * small enough to read.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept one step either side for clock skew

export const counterFor = (atMs: number): number => Math.floor(atMs / 1000 / STEP_SECONDS);

export const totpAt = (secretBase32: string, atMs: number = Date.now()): string => {
  const key = base32Decode(secretBase32);
  const counter = counterFor(atMs);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

export const verifyTotp = (
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
  window = WINDOW,
): boolean => {
  const candidate = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(candidate)) return false;
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = totpAt(secretBase32, atMs + drift * STEP_SECONDS * 1000);
    // Constant-time-ish compare; codes are 6 digits so the risk is negligible,
    // but there is no reason to leak a prefix match.
    let mismatch = 0;
    for (let i = 0; i < expected.length; i += 1) {
      mismatch |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
    }
    if (mismatch === 0) return true;
  }
  return false;
};

export const secondsRemaining = (atMs: number = Date.now()): number =>
  STEP_SECONDS - (Math.floor(atMs / 1000) % STEP_SECONDS);
