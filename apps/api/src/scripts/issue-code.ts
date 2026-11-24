import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../config/env.js';
import { createReferralCode } from '../services/referral.service.js';

process.env.ZONE ??= 'internal';
const env = loadEnv();
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL } },
});

const level = (process.argv[2] as 'UG' | 'PG') || 'UG';
const name = process.argv[3] || 'Student Candidate';
const email = process.argv[4] || `student-${Math.random().toString(36).slice(2, 7)}@college.edu.in`;

const sponsorUser = await prisma.user.findFirst({
  where: { role: 'SPONSOR', isActive: true },
});

if (!sponsorUser) {
  console.error('No active sponsor account found. Run npm run db:seed first.');
  process.exit(1);
}

const result = await createReferralCode(
  { prisma, env },
  {
    userId: sponsorUser.id,
    level,
    studentName: name,
    studentEmail: email,
    ip: '127.0.0.1',
  },
);

console.log('\n========================================');
console.log('  ADA REFERRAL CODE ISSUED FOR TESTING');
console.log('========================================');
console.log(`Referral Code : ${result.code}`);
console.log(`Level         : ${result.level}`);
console.log(`Student Name  : ${name}`);
console.log(`Student Email : ${email}`);
console.log(`Sponsor       : ${result.sponsorName} (${result.labCode})`);
console.log(`Expires At    : ${result.expiresAt.toISOString()}`);
console.log('========================================\n');

await prisma.$disconnect();
