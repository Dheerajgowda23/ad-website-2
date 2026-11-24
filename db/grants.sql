-- ---------------------------------------------------------------------------
-- Two privilege levels over one database (handoff §3).
--   portal_public    internet/DMZ zone
--   portal_internal  intranet zone (full DML, no DDL)
--
-- Run once by db/init-roles.sh when the Postgres container initialises. Passwords
-- and the database name come from psql variables, never hardcoded here: an
-- air-gapped install generates its own secrets and must still authenticate.
--
-- Per-table grants live in the migrations, because they can only be applied once
-- the tables exist and they must be explicit - the public role is *not* granted
-- every future table.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

-- Create if missing, then always set the current password (rotation is safe).
SELECT format('CREATE ROLE portal_public LOGIN PASSWORD %L NOCREATEDB NOCREATEROLE NOSUPERUSER', :'public_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_public')
\gexec

SELECT format('CREATE ROLE portal_internal LOGIN PASSWORD %L NOCREATEDB NOCREATEROLE NOSUPERUSER', :'internal_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_internal')
\gexec

ALTER ROLE portal_public PASSWORD :'public_pw';
ALTER ROLE portal_internal PASSWORD :'internal_pw';

GRANT CONNECT ON DATABASE :"db_name" TO portal_public, portal_internal;
GRANT USAGE ON SCHEMA public TO portal_public, portal_internal;

-- The intranet runs the casework, so it may use whatever a later migration adds.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_internal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO portal_internal;
