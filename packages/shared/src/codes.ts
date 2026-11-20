/**
 * Referral code format - handoff §6.
 *
 * `LAB-YEAR-XXXX-XXXX`, 8 random symbols from a 32-symbol alphabet with the
 * ambiguous characters (0/O, 1/I/L) removed, and a trailing checksum character
 * so a mistyped code fails locally instead of hitting the API.
 *
 * The plaintext code exists only at issue time. The server stores an HMAC.
 */

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 32 symbols, no 0/O/1/I/L

export const normalizeReferralCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, '');

export const checksumForBody = (body: string): string => {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const index = CODE_ALPHABET.indexOf(body[i] ?? '');
    if (index < 0) return '';
    sum = (sum * 31 + index * (i + 1)) % CODE_ALPHABET.length;
  }
  return CODE_ALPHABET[sum] ?? '';
};

/** `prefix` is the display prefix, e.g. `LRDE-26`. Group body as XXXX-XXXX. */
export const formatReferralCode = (prefix: string, body8: string): string => {
  const body = body8.toUpperCase();
  const grouped = `${body.slice(0, 4)}-${body.slice(4, 8)}`;
  return `${prefix.toUpperCase()}-${grouped}${checksumForBody(grouped.replace('-', ''))}`;
};

export const parseReferralCode = (
  raw: string,
): { ok: true; lab: string; year: number; body: string } | { ok: false; reason: 'FORMAT' | 'CHECKSUM' } => {
  const code = normalizeReferralCode(raw);
  const match = /^([A-Z]{2,6})-([0-9]{2})-([0-9A-Z]{4})-([0-9A-Z]{4})([0-9A-Z])$/.exec(code);
  if (!match) return { ok: false, reason: 'FORMAT' };
  const [, lab, year, a, b, checksum] = match as unknown as [string, string, string, string, string, string];
  const body = `${a}${b}`;
  if (checksumForBody(body) !== checksum) return { ok: false, reason: 'CHECKSUM' };
  return { ok: true, lab, year: 2000 + Number(year), body };
};

/** `ADA/INT/R|O|P/<year>/<0001>` - handoff §5. */
export const ENTRY_CHANNEL_LETTER = { REFERRED: 'R', OPEN: 'O', POSTAL: 'P' } as const;

export const formatApplicationNo = (
  channel: keyof typeof ENTRY_CHANNEL_LETTER,
  year: number,
  sequence: number,
): string => `ADA/INT/${ENTRY_CHANNEL_LETTER[channel]}/${year}/${String(sequence).padStart(4, '0')}`;

/** Mask Aadhaar everywhere. Only the last four digits are ever stored (§1.5). */
export const maskAadhaar = (last4: string | null | undefined): string =>
  last4 ? `XXXX XXXX ${last4}` : '—';
