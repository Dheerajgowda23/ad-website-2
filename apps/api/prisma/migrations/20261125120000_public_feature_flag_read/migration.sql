-- The public zone evaluates feature flags on every guarded route (status check,
-- certificate verification). Without SELECT the middleware threw a 42501 and the
-- route answered 500, which surfaced as "lookup error" on the status page.
-- Flags are read-only for the public role; only the intranet may change them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_public') THEN
    GRANT SELECT ON "feature_flags" TO portal_public;
  END IF;
END
$$;
