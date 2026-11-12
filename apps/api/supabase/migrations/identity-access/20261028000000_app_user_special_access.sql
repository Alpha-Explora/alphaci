-- Migration: 20261028000000_app_user_special_access
--
-- Purpose: per-person grants on top of the global persona (app_role).
--   qa_release          act as QA in QA runs (sign off) and merge to main,
--                       without any Product owner power.
--   deployment_override merge to main past a blocked promotion gate, with an
--                       audited written reason.
-- Set only in the Admin Console. GitHub team sync never touches it, so a
-- grant survives the next login.
--
-- Additive and idempotent: existing users get an empty list.
ALTER TABLE identity.app_users
  ADD COLUMN IF NOT EXISTS special_access text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'identity.app_users'::regclass
      AND conname = 'app_users_special_access_check'
  ) THEN
    ALTER TABLE identity.app_users
      ADD CONSTRAINT app_users_special_access_check
      CHECK (special_access <@ ARRAY['qa_release', 'deployment_override']::text[]);
  END IF;
END $$;

COMMENT ON COLUMN identity.app_users.special_access IS
  'Admin-granted extras on top of app_role: qa_release, deployment_override.';
