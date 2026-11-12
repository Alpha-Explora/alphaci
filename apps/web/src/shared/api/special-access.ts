import type { SpecialAccess } from '@alphaci/persona-rules';

/*
 * Admin-granted extras on top of the persona. The rules are the API's own,
 * from @alphaci/persona-rules; only the Console's wording lives here.
 */
export {
  actingQaRole,
  parseSpecialAccess,
  SPECIAL_ACCESS,
  type SpecialAccess,
} from '@alphaci/persona-rules';

export const SPECIAL_ACCESS_LABELS: Record<
  SpecialAccess,
  { title: string; description: string }
> = {
  qa_release: {
    title: 'QA sign-off and release',
    description:
      'Acts as QA in QA Studio: runs, verifies, signs off and merges. No Product owner powers.',
  },
  deployment_override: {
    title: 'Deployment override',
    description:
      'May merge to main past a blocked promotion gate with a written, audited reason.',
  },
};
