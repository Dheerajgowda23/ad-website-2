/**
 * Roles and zones - handoff §2 and §3.
 *
 * Two zones, eight roles. The zone a role belongs to is a property of the role,
 * not of the request: the API never learns a role from a client payload.
 */

export const ZONES = ['public', 'internal'] as const;
export type Zone = (typeof ZONES)[number];

export const ROLES = [
  'STUDENT',
  'SPONSOR',
  'GUIDE',
  'DIRECTORATE_HEAD',
  'ADMIN_HR',
  'COMMITTEE',
  'DIRECTOR',
  'SECURITY',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Student',
  SPONSOR: 'ADA / DRDO employee (referral sponsor)',
  GUIDE: 'Guide',
  DIRECTORATE_HEAD: 'Directorate head',
  ADMIN_HR: 'Admin & HR',
  COMMITTEE: 'Selection committee member',
  DIRECTOR: 'Director (Admin & HR)',
  SECURITY: 'Security',
};

/** The only zone a role can hold a session in. */
export const ROLE_ZONE: Record<Role, Zone> = {
  STUDENT: 'public',
  SPONSOR: 'internal',
  GUIDE: 'internal',
  DIRECTORATE_HEAD: 'internal',
  ADMIN_HR: 'internal',
  COMMITTEE: 'internal',
  DIRECTOR: 'internal',
  SECURITY: 'internal',
};

/** Staff are the intranet population. Students are the only internet-only role. */
export const STAFF_ROLES: readonly Role[] = [
  'SPONSOR',
  'GUIDE',
  'DIRECTORATE_HEAD',
  'ADMIN_HR',
  'COMMITTEE',
  'DIRECTOR',
  'SECURITY',
];

export const isStaffRole = (role: string): role is Exclude<Role, 'STUDENT'> =>
  (STAFF_ROLES as readonly string[]).includes(role);

/** Only ADA addresses sign in to the intranet. No college accounts exist (§1.2). */
export const ADA_EMAIL_DOMAIN = 'ada.gov.in';

export const isAdaEmail = (email: string): boolean => {
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith(`@${ADA_EMAIL_DOMAIN}`)) return false;
  const local = lower.slice(0, -(ADA_EMAIL_DOMAIN.length + 1));
  return local.length > 0 && !local.includes('@');
};

export const zoneFromEnv = (value: string | undefined): Zone | null =>
  value === 'public' || value === 'internal' ? value : null;
