-- ---------------------------------------------------------------------------
-- Two privilege levels over one database (handoff §3).
--   portal_public    internet/DMZ zone
--   portal_internal  intranet zone (full DML, no DDL)
--
-- This file runs once, when the Postgres container initialises: it creates the
-- roles and gives them the schema. Per-table grants are in the initial
-- migration, because they can only be applied once the tables exist and they
-- must be explicit - the public role is *not* granted every future table.
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

-- The intranet runs the casework, so it may use whatever a later migration adds.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_internal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO portal_internal;
