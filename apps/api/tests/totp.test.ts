import { describe, expect, it } from 'vitest';
import { totpAt, verifyTotp } from '../src/lib/totp.js';
import { base32Decode } from '../src/lib/crypto.js';
import { parseReferralCode, formatReferralCode, checksumForBody } from '@ada/shared';

describe('totp', () => {
  // RFC 6238 appendix B, SHA-1 seed "12345678901234567890".
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches the RFC 6238 test vectors', () => {
    expect(totpAt(secret, 59_000)).toBe('287082');
    expect(totpAt(secret, 1_111_111_109_000)).toBe('081804');
    expect(totpAt(secret, 2_000_000_000_000)).toBe('279037');
  });

  it('accepts one step of clock skew and nothing more', () => {
    const code = totpAt(secret, 59_000);
    expect(verifyTotp(secret, code, 59_000)).toBe(true);
    expect(verifyTotp(secret, code, 119_000)).toBe(false);
  });

  it('decodes base32 to the RFC seed bytes', () => {
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
  });
});

describe('referral codes', () => {
  it('round-trips a formatted code and detects a typo in the checksum', () => {
    // Seven random symbols plus the checksum symbol make the eight-character body.
    const payload = '7K4Q9M2';
    const code = formatReferralCode('LRDE-26', `${payload}${checksumForBody(payload)}`);

    expect(parseReferralCode(code).ok).toBe(true);
    expect(code).toMatch(/^LRDE-26-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    // Corrupt the checksum character: the typo fails locally, without a request.
    const checksum = code.slice(-1);
    const tampered = `${code.slice(0, -1)}${checksum === '2' ? '3' : '2'}`;
    expect(parseReferralCode(tampered)).toEqual({ ok: false, reason: 'CHECKSUM' });
  });
});
