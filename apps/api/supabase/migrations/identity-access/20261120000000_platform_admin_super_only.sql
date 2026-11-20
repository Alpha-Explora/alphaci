-- Migration: 20261120000000_platform_admin_super_only
--
-- Purpose: identity.platform_admins holds only the super-admin. The Admin tier
-- is app_role 'admin' (set in the Admin Console).
--
-- A bare 'admin' row (the old read-only oversight tier) meant three different
-- things: the Admin Console guard ignored it (a person demoted to Lead must
-- lose the admin tab), while /auth/me, the hierarchy and project gates treated
-- any row as admin. A person granted it saw admin in the UI and in teams, and
-- got 403 in the Console.
--
-- Each such person keeps the admin access the row was granted for: they become
-- app_role 'admin', pinned (app_role_source 'manual') so a GitHub team sync
-- does not undo it, and the row goes. The check then admits only
-- 'super_admin', so the two tiers cannot drift apart again.
--
-- Idempotent: re-running finds no 'admin' rows and re-creates the same check.

UPDATE identity.app_users AS app_user
SET app_role = 'admin',
    app_role_source = 'manual',
    updated_at = NOW()
FROM identity.platform_admins AS platform_admin
WHERE platform_admin.user_id = app_user.id
  AND platform_admin.role = 'admin';

DELETE FROM identity.platform_admins WHERE role = 'admin';

ALTER TABLE identity.platform_admins
  DROP CONSTRAINT IF EXISTS platform_admins_role_check;
ALTER TABLE identity.platform_admins
  ADD CONSTRAINT platform_admins_role_check CHECK (role = 'super_admin');

COMMENT ON TABLE identity.platform_admins
  IS 'The platform super-admin. The Admin tier is identity.app_users.app_role = ''admin''. RLS deny-by-default; reachable only via backend service-role.';
