/* Pure rules for the settings surface. No React, no Next, no fetch. */

/**
 * Whether the account-deletion button should be armed.
 *
 * The confirmation is the user's own login typed exactly — not a fixed word —
 * so the phrase differs per account and cannot be muscle-memoried.
 */
export function canDeleteAccount(
  typed: string,
  login: string | undefined,
): boolean {
  return Boolean(login) && typed === login;
}
/**
 * Whether the caller may manage the workspace's members. Mirrors the BE's
 * workspace-level authorization: admins and delegated leads only.
 */
export function canManageWorkspaceMembers(role: string | null | undefined): boolean {
  return role === "admin" || role === "delegated_lead";
}
