-- ---------------------------------------------------------------------------
-- Two privilege levels over one database (handoff §3).
--   portal_public    internet/DMZ zone: writes inbound submissions and
--                    revisions, reads back only its own narrow surface.
--   portal_internal  intranet zone: full DML, still no DDL.
-- Neither runtime role can create, alter or drop. Schema changes are the
-- migration owner's job (MIGRATION_DATABASE_URL).
--
-- Applied by the Postgres container on first boot. Re-runnable.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_public') THEN
    CREATE ROLE portal_public LOGIN PASSWORD 'portal_public_dev_pw' NOCREATEDB NOCREATEROLE NOSUPERUSER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_internal') THEN
    CREATE ROLE portal_internal LOGIN PASSWORD 'portal_internal_dev_pw' NOCREATEDB NOCREATEROLE NOSUPERUSER;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE ada_portal TO portal_public, portal_internal;
GRANT USAGE ON SCHEMA public TO portal_public, portal_internal;

-- The public zone can write inbound things and read back what it wrote.
GRANT SELECT, INSERT, UPDATE ON
  students,
  applications,
  application_revisions,
  documents,
  otp_challenges,
  referral_codes,
  session_public,
  notifications,
  audit_log,
  zone_events
TO portal_public;

-- It may look up which application an invitation belongs to, never the roster.
GRANT SELECT ON intake_years, directorates, labs TO portal_public;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portal_public, portal_internal;

-- The intranet zone runs the casework: full DML on every base table, no DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_internal;

-- Anything a later migration creates inherits the same shape.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO portal_public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_internal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO portal_public, portal_internal;
