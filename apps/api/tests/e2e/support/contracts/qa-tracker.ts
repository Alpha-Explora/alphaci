import type {
  ProjectSemanticCoverage,
  ProjectTodo,
  ProjectTodoList,
  QaHistoryPage,
  QaImportPreviewResponse,
  SpecialAccessResponse,
} from '@alphaci/api-contracts';
import { z } from 'zod';

/*
 * Runtime schemas for the QA release-tracker responses declared in
 * @alphaci/api-contracts: team to-dos, QA history, semantic coverage, the
 * import preview and special access. As in hierarchy.ts, strictObject fails a
 * response that sends an undeclared field, and Matches fails the compile when
 * a schema and its type stop describing the same shape.
 */

type Matches<Schema extends z.ZodType, Contract> =
  z.output<Schema> extends Contract
    ? Contract extends z.output<Schema>
      ? true
      : never
    : never;

const timestamp = z.iso.datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const TodoPersonSchema = z.strictObject({
  id: z.uuid(),
  login: z.string().nullable(),
});

export const ProjectTodoSchema = z.strictObject({
  id: z.uuid(),
  deliveryProjectId: z.uuid(),
  title: z.string(),
  notes: z.string().nullable(),
  assignee: TodoPersonSchema.nullable(),
  dueDate: dateOnly.nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable(),
  status: z.enum(['open', 'done']),
  createdBy: TodoPersonSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: timestamp.nullable(),
  completedByLogin: z.string().nullable(),
  rowVersion: z.number().int().positive(),
  canEdit: z.boolean(),
});

export const ProjectTodoListSchema = z.strictObject({
  todos: z.array(ProjectTodoSchema),
  assignees: z.array(TodoPersonSchema),
});

const QaHistoryEventSchema = z.strictObject({
  id: z.string(),
  createdAt: timestamp,
  iterationId: z.uuid(),
  iterationNumber: z.number().int().positive(),
  runId: z.uuid().nullable(),
  itemId: z.uuid().nullable(),
  title: z.string(),
  requirementName: z.string(),
  actorLogin: z.string().nullable(),
  type: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});

export const QaHistoryPageSchema = z.strictObject({
  events: z.array(QaHistoryEventSchema),
  nextCursor: z.string().nullable(),
});

const CriterionCoverageSchema = z.strictObject({
  text: z.string(),
  status: z.enum(['covered', 'weak', 'uncovered']),
  score: z.number().min(0).max(1),
  matchedTestCase: z
    .strictObject({ id: z.uuid(), title: z.string() })
    .nullable(),
  matchedTerms: z.array(z.string()),
  missingTerms: z.array(z.string()),
});

const StoryCoverageSchema = z.strictObject({
  itemId: z.uuid(),
  title: z.string(),
  status: z.enum(['covered', 'gaps', 'untested', 'no_criteria']),
  testCaseCount: z.number().int().nonnegative(),
  criteria: z.array(CriterionCoverageSchema),
});

const count = z.number().int().nonnegative();

export const ProjectSemanticCoverageSchema = z.strictObject({
  deliveryProjectId: z.uuid(),
  generatedAt: timestamp,
  method: z.literal('keyword-overlap'),
  thresholds: z.strictObject({ covered: z.number(), weak: z.number() }),
  summary: z.strictObject({
    stories: count,
    covered: count,
    gaps: count,
    untested: count,
    noCriteria: count,
    criteria: count,
    criteriaCovered: count,
    criteriaWeak: count,
    criteriaUncovered: count,
    coverageRate: z.number().min(0).max(1).nullable(),
  }),
  features: z.array(
    z.strictObject({
      requirementId: z.uuid(),
      name: z.string(),
      stories: z.array(StoryCoverageSchema),
    }),
  ),
});

export const QaImportPreviewSchema = z.strictObject({
  sheets: z.array(
    z.strictObject({
      name: z.string(),
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
  ),
});

export const SpecialAccessResponseSchema = z.strictObject({
  specialAccess: z.array(z.enum(['qa_release', 'deployment_override'])),
});

export const _projectTodo: Matches<typeof ProjectTodoSchema, ProjectTodo> =
  true;
export const _projectTodoList: Matches<
  typeof ProjectTodoListSchema,
  ProjectTodoList
> = true;
export const _qaHistoryPage: Matches<
  typeof QaHistoryPageSchema,
  QaHistoryPage
> = true;
export const _semanticCoverage: Matches<
  typeof ProjectSemanticCoverageSchema,
  ProjectSemanticCoverage
> = true;
export const _importPreview: Matches<
  typeof QaImportPreviewSchema,
  QaImportPreviewResponse
> = true;
export const _specialAccess: Matches<
  typeof SpecialAccessResponseSchema,
  SpecialAccessResponse
> = true;
