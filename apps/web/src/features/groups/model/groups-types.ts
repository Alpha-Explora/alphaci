/* Domain types for the groups hierarchy.
 *
 * The wire shapes still live in lib/api/hierarchy-contracts, shared with the
 * unmigrated verticals; re-exporting through this file gives the slice one type
 * surface, so when those contracts are decomposed per-domain only this file
 * changes rather than every view. */
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
  UpdateGroupRequest,
} from "@/lib/api/hierarchy-contracts";
export type { AuthMeResponse, ProvisionedProject } from "@/lib/api/contracts";
