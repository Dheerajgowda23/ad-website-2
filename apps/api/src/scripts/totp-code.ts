/**
 * Print the current TOTP code for a seeded account, for local sign-in when an
 * authenticator app is not at hand. Reads the secret the same way the API does.
 */
import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../config/env.js';
import { totpAt, secondsRemaining } from '../lib/totp.js';

process.env.ZONE ??= 'internal';
const env = loadEnv();
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL } },
});

const email = process.argv[2];
if (!email) {
  console.error('usage: npm run totp -w @ada/api -- <email>');
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email }, select: { totpSecret: true, role: true } });
if (!user?.totpSecret) {
  console.error(`No enrolled TOTP secret for ${email}`);
  process.exit(1);
}

console.log(`${user.role.padEnd(17)}${email}  ${totpAt(user.totpSecret)}  (valid ${secondsRemaining()}s)`);
await prisma.$disconnect();
