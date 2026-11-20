-- Grants on offers, certificates, and files for portal_public
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_public') THEN
    GRANT SELECT, UPDATE ON "offers" TO portal_public;
    GRANT SELECT ON "certificates" TO portal_public;
    GRANT SELECT, INSERT, UPDATE ON "files" TO portal_public;
  END IF;
END
$$;
