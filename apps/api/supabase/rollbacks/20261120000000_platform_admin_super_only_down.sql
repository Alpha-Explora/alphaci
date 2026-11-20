-- Rollback: 20261120000000_platform_admin_super_only
--
-- Restores the two-value check. The deleted 'admin' rows are not recreated:
-- their holders kept app_role 'admin', which is the access the rows granted.
-- Recreate a row by hand only if the old code is redeployed and needs it.

ALTER TABLE identity.platform_admins
  DROP CONSTRAINT IF EXISTS platform_admins_role_check;
ALTER TABLE identity.platform_admins
  ADD CONSTRAINT platform_admins_role_check CHECK (role IN ('admin', 'super_admin'));

COMMENT ON TABLE identity.platform_admins
  IS 'Platform-level admin grants (admin | super_admin). Distinct from orgs.workspace_members. RLS deny-by-default; reachable only via backend service-role.';
