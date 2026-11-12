/*
 * Special access (qa_release, deployment_override): grants an admin adds to
 * one person on top of their persona (identity.app_users.special_access).
 * Declared once in @alphaci/persona-rules, where the web app reads the same
 * rules; re-exported here so projects and identity-access keep one import path.
 */
export {
  actingQaRole,
  canOverrideDeployment,
  OVERRIDE_REASON_MIN_LENGTH,
  parseSpecialAccess,
  SPECIAL_ACCESS,
  type SpecialAccess,
} from '@alphaci/persona-rules';
