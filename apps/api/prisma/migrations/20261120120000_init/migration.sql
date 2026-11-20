-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'SPONSOR', 'GUIDE', 'DIRECTORATE_HEAD', 'ADMIN_HR', 'COMMITTEE', 'DIRECTOR', 'SECURITY');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('public', 'internal');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('UG', 'PG');

-- CreateEnum
CREATE TYPE "EntryChannel" AS ENUM ('REFERRED', 'OPEN', 'POSTAL');

-- CreateEnum
CREATE TYPE "SponsorVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('INVITED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED_FOR_CORRECTION', 'HR_SCREENING', 'REJECTED_ELIGIBILITY', 'COMMITTEE_REVIEW', 'NOT_RECOMMENDED', 'DIRECTOR_DECISION', 'REJECTED', 'OFFER_ISSUED', 'ACCEPTED', 'DOCUMENT_VERIFIED', 'SECURITY_PASS', 'IN_TRAINING', 'COMPLETED', 'CERTIFICATE_ISSUED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('COLLEGE_LETTER', 'RECOMMENDATION_LETTER', 'UNDERTAKING', 'PHOTO', 'SIGNED_DECLARATION', 'POLICE_CLEARANCE', 'ID_PROOF', 'PROGRESS_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('CHAIR', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('RECOMMEND', 'NOT_RECOMMEND', 'REFER');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('STAFF_LOGIN', 'STUDENT_EMAIL', 'SPONSOR_EMAIL');

-- CreateEnum
CREATE TYPE "LabType" AS ENUM ('ADA', 'DRDO_OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "employeeCode" TEXT,
    "directorate_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret" TEXT,
    "totp_enrolled_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directorates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ug_capacity" INTEGER NOT NULL DEFAULT 0,
    "pg_capacity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directorates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LabType" NOT NULL DEFAULT 'DRDO_OTHER',
    "nodal_officer_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "user_id" TEXT,
    "full_name" TEXT NOT NULL,
    "official_email" TEXT NOT NULL,
    "employee_ref" TEXT,
    "verification_status" "SponsorVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "quota_year" INTEGER NOT NULL,
    "quota_used" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_years" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seat_plan_published_at" TIMESTAMP(3),
    "notice_version" TEXT,
    "open_channel_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "code_hmac" TEXT NOT NULL,
    "code_prefix" TEXT NOT NULL,
    "sponsor_id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "intake_year" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "bound_student_email" TEXT,
    "bound_at" TIMESTAMP(3),
    "used_by_application_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "issued_by" TEXT,
    "issued_zone" "Zone" NOT NULL DEFAULT 'internal',
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "full_name" TEXT,
    "dob" DATE,
    "father_name" TEXT,
    "gender" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Indian',
    "aadhaar_last4" TEXT,
    "aadhaar_ref_hash" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "alt_phone" TEXT,
    "permanent_address" TEXT,
    "local_address" TEXT,
    "photo_file_id" TEXT,
    "intake_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "application_no" TEXT,
    "entry_channel" "EntryChannel" NOT NULL,
    "referral_code_id" TEXT,
    "sponsor_id" TEXT,
    "lab_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "discipline" TEXT,
    "branch_code" TEXT,
    "degree" TEXT,
    "semester" TEXT,
    "year_of_study" TEXT,
    "cgpa" DECIMAL(4,2),
    "duration_weeks" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "topic" TEXT,
    "synopsis" TEXT,
    "employee_child_flag" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'INVITED',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "intake_year" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "last_edited_at" TIMESTAMP(3),
    "college_letter_verified_by" TEXT,
    "college_letter_verified_at" TIMESTAMP(3),
    "directorate_assigned_by" TEXT,
    "directorate_id" TEXT,
    "committee_batch_id" TEXT,
    "decision_at" TIMESTAMP(3),
    "decision_by" TEXT,
    "rejection_reason_code" TEXT,
    "cancellation_reason" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_revisions" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "changed_fields" TEXT[],
    "sha256" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "application_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" TEXT,
    "file_id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "committee_member_id" TEXT NOT NULL,
    "score" DECIMAL(5,2),
    "remarks" TEXT,
    "recommendation" "ReviewRecommendation",
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_assignments" (
    "id" TEXT NOT NULL,
    "intake_year" INTEGER NOT NULL,
    "batch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL DEFAULT 'MEMBER',
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "committee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directorate_assignments" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "directorate_id" TEXT NOT NULL,
    "guide_id" TEXT,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "directorate_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "guide_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporting_date" DATE,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "pdf_file_id" TEXT,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joining" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "police_clearance_file_id" TEXT,
    "id_proof_file_id" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "pass_no" TEXT,
    "pass_issued_at" TIMESTAMP(3),

    CONSTRAINT "joining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "present_days" INTEGER NOT NULL,
    "total_days" INTEGER NOT NULL,
    "entered_by" TEXT,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" TEXT NOT NULL,
    "pdf_file_id" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zone" "Zone" NOT NULL DEFAULT 'internal',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "application_id" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "template" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "provider_id" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "scan_status" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "quarantined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "zone_public" BOOLEAN NOT NULL DEFAULT false,
    "zone_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_hard_internal" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "zone_events" (
    "id" TEXT NOT NULL,
    "zone" "Zone" NOT NULL,
    "route" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "zone_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_public" (
    "sid" TEXT NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_public_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "session_staff" (
    "sid" TEXT NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_staff_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "subject_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "directorates_code_key" ON "directorates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "labs_code_key" ON "labs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_user_id_key" ON "sponsors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_official_email_quota_year_key" ON "sponsors"("official_email", "quota_year");

-- CreateIndex
CREATE UNIQUE INDEX "intake_years_year_key" ON "intake_years"("year");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_hmac_key" ON "referral_codes"("code_hmac");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_used_by_application_id_key" ON "referral_codes"("used_by_application_id");

-- CreateIndex
CREATE INDEX "referral_codes_expires_at_idx" ON "referral_codes"("expires_at");

-- CreateIndex
CREATE INDEX "students_email_idx" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_aadhaar_ref_hash_intake_year_key" ON "students"("aadhaar_ref_hash", "intake_year");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_intake_year_key" ON "students"("email", "intake_year");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_no_key" ON "applications"("application_no");

-- CreateIndex
CREATE UNIQUE INDEX "applications_referral_code_id_key" ON "applications"("referral_code_id");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_intake_year_level_idx" ON "applications"("intake_year", "level");

-- CreateIndex
CREATE UNIQUE INDEX "application_revisions_application_id_revision_no_key" ON "application_revisions"("application_id", "revision_no");

-- CreateIndex
CREATE UNIQUE INDEX "documents_application_id_kind_version_key" ON "documents"("application_id", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_application_id_committee_member_id_key" ON "reviews"("application_id", "committee_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_assignments_batch_id_user_id_key" ON "committee_assignments"("batch_id", "user_id");

-- CreateIndex
CREATE INDEX "directorate_assignments_guide_id_idx" ON "directorate_assignments"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_application_id_key" ON "offers"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "joining_application_id_key" ON "joining"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "joining_pass_no_key" ON "joining"("pass_no");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_application_id_month_key" ON "attendance"("application_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_application_id_key" ON "certificates"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_serial_no_key" ON "certificates"("serial_no");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "zone_events_at_idx" ON "zone_events"("at");

-- CreateIndex
CREATE INDEX "session_public_expire_idx" ON "session_public"("expire");

-- CreateIndex
CREATE INDEX "session_staff_expire_idx" ON "session_staff"("expire");

-- CreateIndex
CREATE INDEX "otp_challenges_subject_hash_purpose_idx" ON "otp_challenges"("subject_hash", "purpose");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_directorate_id_fkey" FOREIGN KEY ("directorate_id") REFERENCES "directorates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_directorate_id_fkey" FOREIGN KEY ("directorate_id") REFERENCES "directorates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_revisions" ADD CONSTRAINT "application_revisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_committee_member_id_fkey" FOREIGN KEY ("committee_member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directorate_assignments" ADD CONSTRAINT "directorate_assignments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directorate_assignments" ADD CONSTRAINT "directorate_assignments_directorate_id_fkey" FOREIGN KEY ("directorate_id") REFERENCES "directorates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directorate_assignments" ADD CONSTRAINT "directorate_assignments_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining" ADD CONSTRAINT "joining_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Application number sequence (handoff §5): allocated inside the submission
-- transaction so a number is never reused or visibly skipped.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS "application_no_seq" START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- Runtime grants. The public role may write inbound records and read back what
-- it wrote; it may never read users, sponsors, reviews or configuration.
-- The internal role runs the casework: full DML, still no DDL.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_public') THEN
    GRANT SELECT, INSERT, UPDATE ON
      "students", "applications", "application_revisions", "documents",
      "otp_challenges", "referral_codes", "notifications", "audit_log", "zone_events"
    TO portal_public;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "session_public" TO portal_public;
    GRANT SELECT ON "intake_years", "directorates", "labs" TO portal_public;
    GRANT USAGE, SELECT ON SEQUENCE "application_no_seq" TO portal_public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_internal') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_internal;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portal_internal;
  END IF;
END
$$;
