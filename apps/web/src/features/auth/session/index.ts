export {
  useAuthSessionViewModel,
  useAuthSessionViewModel as useAuthSession,
} from "./view-models/use-auth-session-view-model";
export { useSignOutAndRedirect } from "./view-models/use-sign-out-and-redirect";
export type {
  AuthSessionStatus,
  AuthSessionViewModel,
} from "./view-models/use-auth-session-view-model";
export {
  authErrorStatus,
  completeOnboarding,
  createGitHubLoginUrl,
  deleteAccount,
  getCurrentSession,
  getPendingAccount,
  isAuthApiError,
  restoreAccount,
  signOut,
  startFreshAccount,
  warmupBackend,
} from "./data/auth-repository";
export type { AuthSession } from "./model/auth-types";
export type { PendingAccount } from "./model/pending-account";
export {
  getAuthenticatedRedirectPath,
  isGuest,
  isInternalUser,
} from "./model/auth-rules";
