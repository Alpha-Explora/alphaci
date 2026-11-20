import type { ProjectDriftRepairAction } from '#kernel/ports/deployment-runtime.port';
import { IsIn, IsOptional } from 'class-validator';

const REPAIR_ACTIONS = [
  'regenerate_workflow_preview',
  'create_workflow_update_pr',
  'rotate_ci_token',
  'detach_target',
  'repair_branch_protection',
  'repair_ci_api_url',
  'mark_ignored',
] as const satisfies readonly ProjectDriftRepairAction[];

/** Body of POST /projects/:id/drift/:findingId/repair. Omitted action = mark_ignored. */
export class RepairDriftFindingDto {
  @IsOptional()
  @IsIn(REPAIR_ACTIONS)
  action?: ProjectDriftRepairAction;
}
