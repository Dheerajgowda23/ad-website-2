import { createHmac, randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { CODE_ALPHABET, checksumForBody } from '@ada/shared';

export const sha256Hex = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');

export const hmacHex = (value: string, pepper: string): string =>
  createHmac('sha256', pepper).update(value).digest('hex');

export const hmacBase64Url = (value: string, pepper: string): string =>
  createHmac('sha256', pepper).update(value).digest('base64url');

export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

// --- OTP -------------------------------------------------------------------

const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashSecret = (value: string): Promise<string> => argonHash(value, ARGON_OPTIONS);

export const verifySecret = async (hashed: string, value: string): Promise<boolean> => {
  try {
    return await argonVerify(hashed, value);
  } catch {
    return false;
  }
};

/** Six digits, uniformly distributed. */
export const generateOtp = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

// --- Opaque signed tokens ---------------------------------------------------
//
// Used for the short-lived referral and pending-2FA tokens. Not JWTs: the
// payload is HMAC-signed, single-purpose and minutes-long, and the server keeps
// no trust in anything the client repeats back.

interface TokenPayload {
  [key: string]: string | number;
}

export const signToken = (payload: TokenPayload, pepper: string, ttlSeconds: number, now = Date.now()): string => {
  const body = { ...payload, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${encoded}.${hmacBase64Url(encoded, pepper)}`;
};

export const verifyToken = <T extends TokenPayload>(
  token: string,
  pepper: string,
  now = Date.now(),
): T | null => {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  if (!safeEqual(signature, hmacBase64Url(encoded, pepper))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & {
      exp?: number;
    };
    if (!payload.exp || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
};

export const randomId = (bytes = 16): string => randomBytes(bytes).toString('base64url');

// --- Referral code ---------------------------------------------------------

/**
 * Eight symbols from the 32-symbol alphabet (no 0/O, 1/I/L), grouped XXXX-XXXX,
 * plus the checksum character. Returned once, at issue; never stored in clear.
 */
export const generateReferralBody = (): string => {
  let body = '';
  for (let i = 0; i < 8; i += 1) body += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  const checksum = checksumForBody(body);
  return `${body.slice(0, 4)}-${body.slice(4)}${checksum}`;
};

// --- Base32 (TOTP secrets) -------------------------------------------------

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input: string): Buffer => {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = B32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

export const generateTotpSecret = (): string => base32Encode(randomBytes(20));
