-- The public zone must show "Referred by <name>, <LAB>" when a code is redeemed,
-- so it needs to read the sponsor row behind the code. It is still a table-level
-- grant: row-level scoping arrives with the RLS migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_public') THEN
    GRANT SELECT ON "sponsors" TO portal_public;
  END IF;
END
$$;
