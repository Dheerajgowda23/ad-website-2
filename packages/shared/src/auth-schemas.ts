import { z } from 'zod';

/**
 * Request schemas. Note what is absent everywhere: `role`, `status`,
 * `applicationNo`, `studentId`. Those are server-derived (§1.6) and a payload
 * that carries them is simply not part of any schema here.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Enter a valid email address');

// --- intranet (staff) ------------------------------------------------------

export const staffEmailRequestSchema = z.object({ email: emailSchema });

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const otpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: otpCodeSchema,
});

export const totpVerifySchema = z.object({
  pendingId: z.string().min(10).max(4096),
  code: otpCodeSchema,
});

// --- public (student) ------------------------------------------------------

/**
 * Referral codes are `LAB-YEAR-XXXX-XXXX`. The alphabet omits 0/O and 1/I/L so a
 * typo is caught locally; the final character is a checksum.
 */
export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}-[0-9]{2}-[0-9A-Z]{4}-[0-9A-Z]{4}$/, 'Enter the referral code exactly as issued');

export const redeemSchema = z.object({ code: referralCodeSchema });

export const studentOtpRequestSchema = z.object({
  referralToken: z.string().min(10).max(4096),
  email: emailSchema,
});

export type StaffEmailRequest = z.infer<typeof staffEmailRequestSchema>;
export type OtpVerifyRequest = z.infer<typeof otpVerifySchema>;
export type TotpVerifyRequest = z.infer<typeof totpVerifySchema>;
export type RedeemRequest = z.infer<typeof redeemSchema>;
export type StudentOtpRequest = z.infer<typeof studentOtpRequestSchema>;
