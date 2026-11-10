BEGIN;
ALTER TABLE identity.app_users
  DROP CONSTRAINT IF EXISTS app_users_special_access_check;
ALTER TABLE identity.app_users
  DROP COLUMN IF EXISTS special_access;
COMMIT;
