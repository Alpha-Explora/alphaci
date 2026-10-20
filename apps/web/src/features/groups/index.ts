/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/groups/detail`,
 * `@/features/groups/members`, …) so a consumer pulls in one action rather
 * than the whole domain. */
export type {
  DeliveryProject,
  GroupActivityItem,
  GroupActivityQuery,
  GroupActivityResponse,
  GroupMember,
  GroupRole,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
  RepositoryAccessStatus,
  RepositoryAccessStatusResponse,
  RepositoryAssignment,
} from "./model/groups-types";
export type { MyAssignedRepository } from "./data/hierarchy-contracts";
export type { AuthMeResponse, ProvisionedProject } from "./model/groups-types";
export type {
  GroupActivityType,
  InternalUserDirectoryEntry,
  RepositoryConfigurationResponse,
} from "./data/hierarchy-contracts";

export {
  GROUP_ROLE_LABELS,
  groupDisplayName,
  isGlobalCreatorRole,
  isGroupManagerRole,
  memberRoleLabel,
  projectStatusVariant,
  repoShortName,
  shouldShowAssignmentReconcile,
  shouldShowAssignmentRevoke,
} from "./model/groups-rules";
export {
  NO_PROJECT_YET_MESSAGE,
  PROJECT_CREATE_FORBIDDEN_MESSAGE,
  PROJECT_FEATURES_REQUIRED_MESSAGE,
  PROJECT_REQUIRED_MESSAGE,
  REPOSITORY_CREATE_FORBIDDEN_MESSAGE,
  canCreateProjectFolder,
  canCreateRepositoryInProject,
  canCreateRepositoryWithoutProject,
  creationRefusalMessage,
  readFeatureCount,
  repositoryBlockedByFeatures,
  repositoryRequiresProject,
  resolveCanCreateProject,
  resolveCanCreateRepository,
} from "./model/creation-role-rules";
/* Who manages a Project's members, and the link to its members panel. */
export { canManageProjectMembers, projectMembersHref } from "./model/project-members-rules";
export * from "./data/hierarchy-api";
export type {
  AssignmentStatus,
  ConfigurationItemMetadata,
  ConfigurationType,
  DeliveryProjectStatus,
  GithubSyncState,
  GroupMemberStatus,
  GroupStatus,
  RepositoryStatus,
  SystemStatus,
} from "./data/hierarchy-contracts";
export {
  timeAgo,
  useApiResource,
  type ResourceState,
  type UseApiResourceResult,
} from "./view-models/use-hierarchy-resource";
export {
  useGroupDeliveryProjectRouteViewModel,
  useGroupRepositoryRouteViewModel,
  useGroupRouteViewModel,
  useGroupSystemRouteViewModel,
} from "./view-models/use-group-route-view-model";
export { useGroupViewModel } from "./view-models/use-group-view-model";
