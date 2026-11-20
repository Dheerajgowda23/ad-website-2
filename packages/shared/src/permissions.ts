import type { Role } from './roles.js';

/**
 * Permissions - the server-side truth for authorisation.
 *
 * A route declares the permission it needs; the role on the server session
 * resolves to a permission set here. Nothing in this file is client input.
 */
export const PERMISSIONS = [
  // student, own record only
  'application:read:own',
  'application:edit:own',
  'application:withdraw:own',
  'document:upload:own',
  'document:read:own',
  'offer:respond:own',
  // sponsor
  'referral:create',
  'referral:read:own',
  'referral:revoke:own',
  // guide / directorate
  'trainee:read',
  'attendance:write',
  'clearance:write',
  'directorate:read',
  'directorate:confirm',
  'topic:approve',
  // admin & hr casework - one role, one dashboard (§1.3)
  'screening:read',
  'screening:write',
  'college_letter:verify',
  'application:assign',
  'application:return',
  'application:reject',
  'seat:read',
  'seat:write',
  'letter:issue',
  'export:run',
  'reporting:read',
  'certificate:issue',
  'user:manage',
  'flag:manage',
  'audit:read',
  // committee
  'committee:read',
  'committee:score',
  // director - decision only, otherwise read
  'decision:read',
  'decision:approve',
  'capacity:override',
  // security
  'security:queue:read',
  'pass:issue',
  'document:verify',
  // configuration (Admin & HR owns it; Director may read)
  'config:read',
  'config:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STUDENT: Permission[] = [
  'application:read:own',
  'application:edit:own',
  'application:withdraw:own',
  'document:upload:own',
  'document:read:own',
  'offer:respond:own',
];

const SPONSOR: Permission[] = ['referral:create', 'referral:read:own', 'referral:revoke:own', 'trainee:read'];

const GUIDE: Permission[] = ['trainee:read', 'attendance:write', 'clearance:write'];

const DIRECTORATE_HEAD: Permission[] = ['directorate:read', 'directorate:confirm', 'topic:approve', 'seat:read', 'trainee:read'];

/** ADMIN_HR is deliberately one role: casework and configuration side by side. */
const ADMIN_HR: Permission[] = [
  'screening:read',
  'screening:write',
  'college_letter:verify',
  'application:assign',
  'application:return',
  'application:reject',
  'seat:read',
  'seat:write',
  'letter:issue',
  'export:run',
  'reporting:read',
  'certificate:issue',
  'user:manage',
  'flag:manage',
  'audit:read',
  'committee:read',
  'decision:read',
  'config:read',
  'config:write',
  'referral:read:own',
];

const COMMITTEE: Permission[] = ['committee:read', 'committee:score'];

const DIRECTOR: Permission[] = [
  'screening:read',
  'seat:read',
  'committee:read',
  'decision:read',
  'decision:approve',
  'capacity:override',
  'audit:read',
  'certificate:issue',
  'config:read',
];

const SECURITY: Permission[] = ['security:queue:read', 'pass:issue', 'document:verify'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  STUDENT,
  SPONSOR,
  GUIDE,
  DIRECTORATE_HEAD,
  ADMIN_HR,
  COMMITTEE,
  DIRECTOR,
  SECURITY,
};

export const permissionsForRole = (role: Role): readonly Permission[] => ROLE_PERMISSIONS[role] ?? [];

export const hasPermission = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

/** Compact role -> permission summary for the login/dashboard screens. */
export const permissionSummary = (): { role: Role; permissions: readonly Permission[] }[] =>
  Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
    role: role as Role,
    permissions,
  }));
