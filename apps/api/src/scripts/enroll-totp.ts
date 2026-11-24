/**
 * Enrol an authenticator for a staff account.
 *
 * In production nobody should use the seeded, derived TOTP secret. Admin & HR runs
 * this once per person, hands over the QR (or the otpauth:// URI) and the account is
 * bound to that person's phone. Re-running it rotates the secret.
 *
 *   npm run totp:enroll -w @ada/api -- admin.hr@ada.gov.in
 *   npm run totp:enroll -w @ada/api -- admin.hr@ada.gov.in --qr /tmp/admin.png
 */
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { loadEnv } from '../config/env.js';
import { base32Encode } from '../lib/crypto.js';
import { writeAudit } from '../lib/audit.js';

process.env.ZONE ??= 'internal';
process.env.DATABASE_URL ??= process.env.MIGRATION_DATABASE_URL;

const env = loadEnv();
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL } },
});

const args = process.argv.slice(2);
const email = (args.find((arg) => !arg.startsWith('--')) ?? '').trim().toLowerCase();
const qrFlag = args.indexOf('--qr');
const qrPath = qrFlag >= 0 ? args[qrFlag + 1] : undefined;

const main = async (): Promise<void> => {
  if (!email) {
    console.error('Usage: npm run totp:enroll -w @ada/api -- <staff-email> [--qr <file.png>]');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email, role: { not: 'STUDENT' }, deletedAt: null },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    console.error(`No staff account with email ${email}`);
    process.exitCode = 1;
    return;
  }

  // 20 random bytes -> 32 base32 characters, the usual TOTP secret length.
  const secret = base32Encode(randomBytes(20));
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnrolledAt: new Date() },
  });

  await writeAudit(prisma, {
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_TOTP_ENROLLED',
    entity: 'user',
    entityId: user.id,
    after: { totpEnrolledAt: new Date().toISOString() },
    reason: 'authenticator enrolled by CLI',
    ip: '127.0.0.1',
    zone: 'internal',
  });

  const issuer = 'ADA Internship Portal';
  const label = encodeURIComponent(`${issuer}:${user.email}`);
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  console.log(`\nAccount : ${user.name} <${user.email}> (${user.role})`);
  console.log(`Secret  : ${secret}`);
  console.log(`otpauth : ${otpauth}`);
  console.log('\nAdd it in Google Authenticator / Microsoft Authenticator / FreeOTP:\n');

  if (qrPath) {
    await QRCode.toFile(qrPath, otpauth, { margin: 1, width: 480 });
    console.log(`QR code written to ${qrPath}\n`);
  } else {
    const ascii = await QRCode.toString(otpauth, { type: 'terminal', small: true, margin: 1 });
    console.log(ascii);
  }

  console.log('The previous secret for this account no longer works. Hand the QR to the person, not over email.\n');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
