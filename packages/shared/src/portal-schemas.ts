import { z } from 'zod';
import { emailSchema } from './auth-schemas.js';

// --- Referral Schemas --------------------------------------------------------

export const createReferralSchema = z.object({
  level: z.enum(['UG', 'PG']),
  studentName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  studentEmail: emailSchema,
});

export const revokeReferralSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(300).optional(),
});

// --- Student Application Form ------------------------------------------------

export const studentDraftSchema = z.object({
  fullName: z.string().trim().max(100).optional().nullable(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  fatherName: z.string().trim().max(100).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  nationality: z.string().default('Indian').optional(),
  aadhaarLast4: z.string().regex(/^\d{4}$/, 'Must be exactly 4 digits').optional().nullable(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a 10-digit mobile number').optional().nullable(),
  altPhone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a 10-digit mobile number').optional().nullable(),
  permanentAddress: z.string().trim().max(500).optional().nullable(),
  localAddress: z.string().trim().max(500).optional().nullable(),
  collegeName: z.string().trim().max(150).optional().nullable(),
  universityName: z.string().trim().max(150).optional().nullable(),
  rollNumber: z.string().trim().max(40).optional().nullable(),
  collegeAddress: z.string().trim().max(300).optional().nullable(),
  category: z.enum(['GENERAL', 'OBC', 'SC', 'ST', 'EWS']).optional().nullable(),
  discipline: z.string().trim().max(100).optional().nullable(),
  branchCode: z.string().trim().max(20).optional().nullable(),
  degree: z.string().trim().max(50).optional().nullable(),
  semester: z.string().trim().max(20).optional().nullable(),
  yearOfStudy: z.string().trim().max(20).optional().nullable(),
  cgpa: z.number().min(0).max(10).optional().nullable(),
  durationWeeks: z.number().int().min(1).max(52).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  topic: z.string().trim().max(250).optional().nullable(),
  synopsis: z
    .string()
    .trim()
    .refine((val) => !val || val.trim().split(/\s+/).filter(Boolean).length <= 150, {
      message: 'Synopsis must not exceed 150 words',
    })
    .optional()
    .nullable(),
  employeeChildFlag: z.boolean().default(false).optional(),
});

export const studentSubmitSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  fatherName: z.string().trim().min(2, "Father's name is required").max(100),
  gender: z.string().min(1, 'Gender is required'),
  nationality: z.literal('Indian', {
    errorMap: () => ({ message: 'Only Indian nationals are eligible under ADA policy' }),
  }),
  aadhaarLast4: z.string().regex(/^\d{4}$/, 'Last 4 digits of Aadhaar are required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, '10-digit valid Indian mobile number is required'),
  altPhone: z.string().regex(/^[6-9]\d{9}$/).optional().nullable(),
  permanentAddress: z.string().trim().min(5, 'Permanent address is required').max(500),
  localAddress: z.string().trim().min(5, 'Local address is required').max(500),
  collegeName: z.string().trim().min(3, 'College / institution name is required').max(150),
  universityName: z.string().trim().min(3, 'University / board is required').max(150),
  rollNumber: z.string().trim().min(1, 'University roll / enrolment number is required').max(40),
  collegeAddress: z.string().trim().min(5, 'College address with PIN is required').max(300),
  category: z.enum(['GENERAL', 'OBC', 'SC', 'ST', 'EWS'], {
    errorMap: () => ({ message: 'Category is required' }),
  }),
  discipline: z.string().trim().min(2, 'Discipline/Department is required').max(100),
  branchCode: z.string().trim().min(1, 'Branch code is required').max(20),
  degree: z.string().trim().min(2, 'Degree is required').max(50),
  semester: z.string().trim().min(1, 'Semester is required').max(20),
  yearOfStudy: z.string().trim().min(1, 'Year of study is required').max(20),
  cgpa: z.number().min(0).max(10, 'CGPA must be between 0 and 10'),
  durationWeeks: z.number().int().min(4, 'Minimum duration is 4 weeks').max(52, 'Maximum duration is 52 weeks'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  topic: z.string().trim().min(5, 'Project topic is required').max(250),
  synopsis: z
    .string()
    .trim()
    .min(10, 'Synopsis must be at least 10 characters')
    .refine((val) => val.trim().split(/\s+/).filter(Boolean).length <= 150, {
      message: 'Synopsis must not exceed 150 words (per Annexure-I)',
    }),
  employeeChildFlag: z.boolean().default(false),
  declarationSigned: z.literal(true, {
    errorMap: () => ({ message: 'You must sign the declaration to submit' }),
  }),
});

/** Student editing after submission — optimistic concurrency via `revision` */
export const studentEditSchema = z.object({
  revision: z.number().int().min(0, 'Revision is required for optimistic concurrency'),
  discipline: z.string().trim().min(2).max(100).optional(),
  branchCode: z.string().trim().min(1).max(20).optional(),
  degree: z.string().trim().min(2).max(50).optional(),
  semester: z.string().trim().min(1).max(20).optional(),
  yearOfStudy: z.string().trim().min(1).max(20).optional(),
  cgpa: z.number().min(0).max(10).optional(),
  durationWeeks: z.number().int().min(4).max(52).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  topic: z.string().trim().min(5).max(250).optional(),
  synopsis: z
    .string()
    .trim()
    .refine((val) => !val || val.trim().split(/\s+/).filter(Boolean).length <= 150, {
      message: 'Synopsis must not exceed 150 words',
    })
    .optional(),
  employeeChildFlag: z.boolean().optional(),
  permanentAddress: z.string().trim().min(5).max(500).optional(),
  localAddress: z.string().trim().min(5).max(500).optional(),
  collegeName: z.string().trim().min(3).max(150).optional(),
  universityName: z.string().trim().min(3).max(150).optional(),
  rollNumber: z.string().trim().min(1).max(40).optional(),
  collegeAddress: z.string().trim().min(5).max(300).optional(),
  category: z.enum(['GENERAL', 'OBC', 'SC', 'ST', 'EWS']).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  altPhone: z.string().regex(/^[6-9]\d{9}$/).optional().nullable(),
});

// --- Document Upload ---------------------------------------------------------

export const documentUploadSchema = z.object({
  kind: z.enum([
    'COLLEGE_LETTER',
    'RECOMMENDATION_LETTER',
    'UNDERTAKING',
    'PHOTO',
    'SIGNED_DECLARATION',
    'POLICE_CLEARANCE',
    'ID_PROOF',
    'PROGRESS_REPORT',
    'OTHER',
  ]),
  fileName: z.string().trim().min(1).max(255),
  mime: z.string().min(1).max(100),
  size: z.number().int().positive().max(10 * 1024 * 1024, 'Max 10MB file size'),
  contentBase64: z.string().min(1, 'File content is required'),
});

// --- Casework & Workflow Action Schemas --------------------------------------

export const returnForCorrectionSchema = z.object({
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(1000),
  deadlineDays: z.number().int().min(1).max(30).default(7),
});

export const rejectEligibilitySchema = z.object({
  reason: z.string().trim().min(5, 'Rejection reason is required').max(1000),
});

export const assignDirectorateCommitteeSchema = z.object({
  directorateId: z.string().min(1, 'Directorate is required'),
  guideId: z.string().optional().nullable(),
  committeeBatchId: z.string().trim().min(1, 'Committee batch is required'),
});

export const committeeReviewSchema = z.object({
  score: z.number().min(0, 'Score must be at least 0').max(100, 'Score cannot exceed 100'),
  remarks: z.string().trim().min(3, 'Remarks are required').max(1000),
  recommendation: z.enum(['RECOMMEND', 'NOT_RECOMMEND', 'REFER']),
});

export const directorDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(1000).optional(),
  reportingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Reporting date must be YYYY-MM-DD').optional(),
  capacityOverride: z.boolean().default(false).optional(),
});

export const securityPassSchema = z.object({
  passNo: z.string().trim().min(3, 'Pass number is required').max(50),
});

export const attendanceEntrySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be format YYYY-MM'),
  presentDays: z.number().int().min(0, 'Present days cannot be negative').max(31, 'Max 31 days'),
  totalDays: z.number().int().min(1, 'Total working days must be at least 1').max(31, 'Max 31 days'),
});

export const certificateIssueSchema = z.object({
  serialNo: z.string().trim().min(5).max(50).optional(),
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;
export type StudentDraftInput = z.infer<typeof studentDraftSchema>;
export type StudentSubmitInput = z.infer<typeof studentSubmitSchema>;
export type StudentEditInput = z.infer<typeof studentEditSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type ReturnForCorrectionInput = z.infer<typeof returnForCorrectionSchema>;
export type RejectEligibilityInput = z.infer<typeof rejectEligibilitySchema>;
export type AssignDirectorateCommitteeInput = z.infer<typeof assignDirectorateCommitteeSchema>;
export type CommitteeReviewInput = z.infer<typeof committeeReviewSchema>;
export type DirectorDecisionInput = z.infer<typeof directorDecisionSchema>;
export type SecurityPassInput = z.infer<typeof securityPassSchema>;
export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;
