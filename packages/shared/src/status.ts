export const LEVELS = ['UG', 'PG'] as const;
export type Level = (typeof LEVELS)[number];

/**
 * The application state machine - handoff §4.
 *
 * One status at a time. Transitions are owned by a service; a client never sends
 * a status. Declared here so the API, both UIs and tests agree on the same edges.
 */
export const APPLICATION_STATUSES = [
  'INVITED',
  'IN_PROGRESS',
  'SUBMITTED',
  'RETURNED_FOR_CORRECTION',
  'HR_SCREENING',
  'REJECTED_ELIGIBILITY',
  'COMMITTEE_REVIEW',
  'NOT_RECOMMENDED',
  'DIRECTOR_DECISION',
  'REJECTED',
  'OFFER_ISSUED',
  'ACCEPTED',
  'DOCUMENT_VERIFIED',
  'SECURITY_PASS',
  'IN_TRAINING',
  'COMPLETED',
  'CERTIFICATE_ISSUED',
  'WITHDRAWN',
  'CANCELLED',
  'EXPIRED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const FORWARD: Partial<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  INVITED: ['IN_PROGRESS', 'EXPIRED'],
  IN_PROGRESS: ['SUBMITTED', 'EXPIRED'],
  SUBMITTED: ['HR_SCREENING', 'RETURNED_FOR_CORRECTION'],
  RETURNED_FOR_CORRECTION: ['SUBMITTED'],
  HR_SCREENING: ['COMMITTEE_REVIEW', 'REJECTED_ELIGIBILITY'],
  COMMITTEE_REVIEW: ['DIRECTOR_DECISION', 'NOT_RECOMMENDED'],
  DIRECTOR_DECISION: ['OFFER_ISSUED', 'REJECTED'],
  OFFER_ISSUED: ['ACCEPTED', 'EXPIRED'],
  ACCEPTED: ['DOCUMENT_VERIFIED'],
  DOCUMENT_VERIFIED: ['SECURITY_PASS'],
  SECURITY_PASS: ['IN_TRAINING'],
  IN_TRAINING: ['COMPLETED'],
  COMPLETED: ['CERTIFICATE_ISSUED'],
};

/** Statuses a student may still edit in; anything else is locked (§7). */
export const EDITABLE_STATUSES: readonly ApplicationStatus[] = ['SUBMITTED', 'RETURNED_FOR_CORRECTION'];

export const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  'REJECTED_ELIGIBILITY',
  'NOT_RECOMMENDED',
  'REJECTED',
  'CERTIFICATE_ISSUED',
  'WITHDRAWN',
  'CANCELLED',
  'EXPIRED',
];

/** Statuses that occupy a seat. Reserved is counted separately at offer issue. */
export const SEAT_OCCUPYING_STATUSES: readonly ApplicationStatus[] = [
  'ACCEPTED',
  'DOCUMENT_VERIFIED',
  'SECURITY_PASS',
  'IN_TRAINING',
  'COMPLETED',
  'CERTIFICATE_ISSUED',
];

export const canTransition = (from: ApplicationStatus, to: ApplicationStatus): boolean => {
  if (from === to) return false;
  // Any active application can be withdrawn by the student or cancelled by Admin & HR.
  if (to === 'WITHDRAWN' || to === 'CANCELLED') return !TERMINAL_STATUSES.includes(from) && from !== 'CERTIFICATE_ISSUED';
  return FORWARD[from]?.includes(to) ?? false;
};

export const isEditable = (status: ApplicationStatus): boolean => EDITABLE_STATUSES.includes(status);

export const isLocked = (status: ApplicationStatus): boolean =>
  !EDITABLE_STATUSES.includes(status) && status !== 'IN_PROGRESS' && status !== 'INVITED';
