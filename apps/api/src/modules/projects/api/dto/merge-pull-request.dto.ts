import { IsIn, IsOptional } from 'class-validator';

export const MERGE_METHODS = ['merge', 'squash', 'rebase'] as const;
export type MergeMethod = (typeof MERGE_METHODS)[number];

/** Body of POST /projects/:projectId/pull-requests/:number/merge. */
export class MergePullRequestDto {
  @IsOptional()
  @IsIn(MERGE_METHODS, {
    message: 'Invalid merge method. Use merge, squash or rebase.',
  })
  method?: MergeMethod;
}
