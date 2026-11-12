import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import type { BrowserContext, Locator, Page, Route } from '@playwright/test';

import type {
  AppRole,
  AuthMeResponse,
  CapabilitiesResponse,
  ProjectAuditEventsResponse,
  ProjectCommitsResponse,
  ProjectOptionsResponse,
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
  ProvisionedProject,
  WorkflowFileMetadata,
} from '../../src/shared/api/contracts';
import type {
  DeliveryProject,
  GroupMember,
  GroupSummary,
} from '../../src/features/groups/data/hierarchy-contracts';
import type {
  MoveRepositoryResponseWire,
  ProjectFoldersResponseWire,
  RepoRole,
} from '../../src/features/teams/project-folders/model/project-folder-types';
import type { ProjectFolderWire } from '../../src/features/projects/detail/model/project-folder-types';
import type { NotificationsResponse } from '../../src/features/notifications/model/notifications-types';
import type { WorkspacesMeResponse } from '../../src/features/workspace/selection/model/workspace-types';
import type {
  ChecklistTargetPersona,
  ChecklistVerificationType,
  QaChecklist,
  QaChecklistItemInput,
  QaChecklistListResponse,
} from '../../src/features/checklists/model/checklist-types';
import type {
  QaAutomatedResultWire,
  QaAutomationDispatchWire,
  QaRunAutomationWire,
  QaStageAutomationWire,
} from '../../src/features/checklists/model/qa-automation-types';
import type { QaReport } from '../../src/features/checklists/model/qa-report-types';
import type {
  QaPromotionChecklistWire,
  QaPromotionMergeWire,
  QaPromotionStatusWire,
} from '../../src/features/checklists/model/qa-promotion-types';
import type {
  QaActor,
  QaCurrentRunResponse,
  QaDefectSeverity,
  QaFixRequest,
  QaMyItemsResponse,
  QaReturnedItem,
  QaReturnedItemsResponse,
  QaRun,
  QaRunItem,
  QaRunItemStatus,
  QaSignoff,
  QaVerdict,
} from '../../src/features/checklists/model/qa-run-types';
import type {
  ProjectRequirementsResponseWire,
  RequirementItemWire,
  RequirementKind,
  RequirementProgress,
  RequirementWire,
} from '../../src/features/checklists/model/requirement-types';
import type { HeadStatusWire } from '../../src/features/checklists/model/project-run-types';
import type {
  RunTestCategory,
  TestCaseStatus,
  TestCategoryDefinition,
} from '../../src/features/checklists/model/test-case-types';
import { json, text } from './support';

/* QA journeys — the QA checklist feature driven end to end, one persona at a
 * time, against a stateful mock of the backend.
 *
 * Each journey is one test in qa-journeys.spec.ts, with Playwright's own
 * browser context and its own QaMockBackend, so a write in one journey never
 * leaks into the next.
 *
 * The mock mirrors the backend contract, not just its shapes:
 *   - response bodies are typed with the frontend's own wire types (the same
 *     ones the app parses), and
 *   - the rules the UI depends on are ported from the API
 *     (apps/api/src/modules/projects/), with its error
 *     messages: domain/qa-run-access.rules.ts (who may do what),
 *     application/qa-runs/qa-runs.service.ts (severity required, verdict
 *     rules, re-test only from returned_to_dev, rowVersion conflicts),
 *     application/qa-runs/qa-automation-matching.ts (how an item gets its
 *     automated result), qa-report.mapper.ts (the report JSON) and
 *     application/qa-checklists/qa-checklists.service.ts (who manages
 *     checklists, what sharing accepts), the project-folder endpoints
 *     (GET /groups/:id/project-folders, 404 for a non-member; POST
 *     /groups/:id/projects; POST /repositories/:id/move, 404 target missing
 *     or in another team, 400 archived, 409 moved concurrently; PATCH
 *     /qa-checklists/:id/projects add/remove), and the Project run:
 *     application/qa-runs/qa-project-runs.service.ts (Pending, Passed or
 *     Failed; Failed needs a severity and returns the story; Passed needs
 *     Done and every test case resolved; no sign-off while an item is
 *     failed; the Product owner's acceptance), qa-run-test-cases.ts (a
 *     run's test cases and results), domain/qa-promotion.rules.ts (the
 *     Project gate's reasons) and qa-project-delivery.service.ts (the
 *     current Iteration and what reached main).
 * So a UI change that starts sending something the real server would refuse
 * fails here as a 4xx instead of passing against a permissive fake.
 *
 * A journey fails on any mock reply of 400 or more, any /api/v1 call nothing
 * mocks (a 404), any uncaught page error and any console error.
 *
 * Run: npm run test:e2e -- qa-journeys (add -g "qa:b" for one journey).
 * E2E_QA_SHOTS=<dir> saves the named screenshots some journeys take. */

/* ── People, places and time ─────────────────────────────────────────────── */

const MINUTE = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

interface Person extends QaActor {
  name: string;
  email: string;
}

const PEOPLE: Record<AppRole, Person> = {
  admin: {
    id: 'user-admin',
    login: 'ria-admin',
    name: 'Ria Admin',
    email: 'ria@example.test',
  },
  lead: {
    id: 'user-lead',
    login: 'tone-lead',
    name: 'Tone Lead',
    email: 'tone@example.test',
  },
  qa: {
    id: 'user-qa',
    login: 'ana-qa',
    name: 'Ana QA',
    email: 'ana@example.test',
  },
  member: {
    id: 'user-dev',
    login: 'miguel-dev',
    name: 'Miguel Dev',
    email: 'miguel@example.test',
  },
};

const ROLE_BADGES: Record<AppRole, string> = {
  admin: 'Admin',
  lead: 'Product owner',
  qa: 'QA Team',
  member: 'Developer',
};

const WORKSPACE = { id: 'ws-checkout', name: 'Checkout squad' };
const PROJECT_ID = 'project-1';
const MAIN_SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
/* uat, the QA branch, is deployed at its own commit from its own URL; main is
 * deployed too, and QA Studio must never offer it. */
const UAT_SHA = '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432';
const PREVIEW_ORIGIN = 'https://storefront-web-git-uat.vercel.app';
const MAIN_PREVIEW_ORIGIN = 'https://storefront-web.vercel.app';
const QA_BRANCH = 'uat';
/* The promotion PR the generated pipeline opened (uat → main), and the merge
 * commit GitHub makes when it is merged. */
const PROMOTION_PR = {
  number: 42,
  url: 'https://github.com/tone/storefront-web/pull/42',
};
const MERGE_SHA = '5a5b5c5d5e5f60718293a4b5c6d7e8f901234567';
/** GitHub's own refusal text for a protected main: the UI must show it verbatim. */
const GITHUB_REFUSAL =
  'At least 1 approving review is required by reviewers with write access.';
const VERIFY_RUN_URL =
  'https://github.com/tone/storefront-web/actions/runs/11873450921';
const QUALITY_RUN_URL =
  'https://github.com/tone/storefront-web/actions/runs/11873450377';

type TeamProject = ProvisionedProject & {
  workflowFiles: WorkflowFileMetadata[];
  workspaceId: string;
};

const PROJECTS: TeamProject[] = [
  {
    id: PROJECT_ID,
    repoFullName: 'tone/storefront-web',
    serviceName: 'storefront-web',
    templateId: 'fe-nextjs',
  },
  {
    id: 'project-2',
    repoFullName: 'tone/orders-api',
    serviceName: 'orders-api',
    templateId: 'be-nestjs',
  },
].map((entry) => ({
  ...entry,
  workflowPath: '.github/workflows/00-alphaci-access.yml',
  workflowFiles: [
    {
      stage: 'access',
      name: 'ALPHACI Access Gate',
      path: '.github/workflows/00-alphaci-access.yml',
      gated: true,
    },
    {
      stage: 'quality',
      name: 'ALPHACI Quality',
      path: '.github/workflows/10-alphaci-quality.yml',
      gated: true,
    },
  ],
  status: 'provisioned' as const,
  githubCommitSha: MAIN_SHA,
  githubCommitUrl: `https://github.com/${entry.repoFullName}/commit/${MAIN_SHA}`,
  failureReason: null,
  repoUrl: `https://github.com/${entry.repoFullName}`,
  visibility: 'private',
  repoShape: 'single',
  projectTypeId: null,
  workflowRecipeId: null,
  projectOptions: {},
  workspaceId: WORKSPACE.id,
}));

/* Team Projects (hierarchy delivery projects). Ids are UUIDs because the
 * create-project wizard only honours a UUID ?project=. */
const STOREFRONT_FOLDER = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a41';
const LOYALTY_FOLDER = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a42';
const SYSTEM_ID = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a40';

interface FolderRepoRow {
  id: string;
  name: string;
  repoFullName: string;
  projectId: string | null;
  role: RepoRole;
  archived: boolean;
}

interface FolderRow {
  id: string;
  name: string;
  createdAt: string;
  archived: boolean;
  repositories: FolderRepoRow[];
}

function seedFolders(): FolderRow[] {
  return [
    {
      id: LOYALTY_FOLDER,
      name: 'loyalty',
      createdAt: ago(20 * 24 * 60 * MINUTE),
      archived: false,
      repositories: [],
    },
    {
      id: STOREFRONT_FOLDER,
      name: 'storefront',
      createdAt: ago(30 * 24 * 60 * MINUTE),
      archived: false,
      repositories: [
        {
          id: 'repo-web',
          name: 'storefront-web',
          repoFullName: 'tone/storefront-web',
          projectId: PROJECT_ID,
          role: 'frontend',
          archived: false,
        },
        {
          id: 'repo-api',
          name: 'orders-api',
          repoFullName: 'tone/orders-api',
          projectId: 'project-2',
          role: 'backend',
          archived: false,
        },
      ],
    },
  ];
}

/* The checklist journey (a) writes, as the lead types it. Journeys (b) and (c)
 * start from this same checklist already saved and shared. */
const RELEASE_CHECKLIST = {
  name: 'Release smoke test',
  description: 'Run before every promotion to production.',
  items: [
    {
      title: 'Checkout completes with a saved card',
      description: 'Use the staging Visa ending 4242.',
      targetPersona: 'qa',
      verificationType: 'playwright',
      testIdentifier: 'e2e/checkout.spec.ts › pays with a saved card',
    },
    {
      title: 'Coupon total matches the cart lines',
      description: null,
      targetPersona: 'all',
      verificationType: 'manual',
      testIdentifier: null,
    },
    {
      title: 'Order confirmation email arrives',
      description: null,
      targetPersona: 'all',
      verificationType: 'manual',
      testIdentifier: null,
    },
  ] satisfies QaChecklistItemInput[],
};

/* A developer-owned check, added for the developer journey (c) so its studio
 * has an item a Developer may change beside items only QA may. */
const DEVELOPER_ITEM: QaChecklistItemInput = {
  title: 'Cart total unit tests pass',
  description: null,
  targetPersona: 'developer',
  verificationType: 'unit_test',
  testIdentifier: 'src/cart/cart-total.test.ts',
};

/** The verify stage failed on exactly the Playwright item's spec file. */
const VERIFY_FAILURE_NAME =
  'e2e/checkout.spec.ts > checkout > pays with a saved card';
const VERIFY_FAILURE_MESSAGE =
  'Expected "Order placed" but the page said "Card declined".';

function defaultAutomation(): Required<QaRunAutomationWire> {
  return {
    verify: {
      stage: 'verify',
      status: 'failure',
      runId: 11873450921,
      runUrl: VERIFY_RUN_URL,
      reportedAt: ago(12 * MINUTE),
      tests: {
        total: 20,
        passed: 19,
        failed: 1,
        failures: [
          { name: VERIFY_FAILURE_NAME, message: VERIFY_FAILURE_MESSAGE },
        ],
        failuresTruncated: false,
      },
    },
    quality: {
      stage: 'quality',
      status: 'success',
      runId: 11873450377,
      runUrl: QUALITY_RUN_URL,
      reportedAt: ago(15 * MINUTE),
      tests: {
        total: 142,
        passed: 142,
        failed: 0,
        failures: [],
        failuresTruncated: false,
      },
    },
  };
}

/* ── Backend rules, ported ───────────────────────────────────────────────── */

/* qa-run-access.rules.ts, verbatim in behaviour. */
function personaAllowsRole(
  persona: ChecklistTargetPersona,
  role: AppRole,
): boolean {
  if (role === 'admin' || role === 'lead') return true;
  if (persona === 'all') return true;
  if (persona === 'developer') return role === 'member';
  return role === 'qa';
}
const canCreateRun = (role: AppRole) =>
  role === 'qa' || role === 'lead' || role === 'admin';
const canSetReturnedToDev = canCreateRun;
const canSignOff = canCreateRun;
const canDispatchAutomation = canCreateRun;
const canRequestRetest = (role: AppRole) =>
  role === 'member' || role === 'lead' || role === 'admin';
const canReopenRun = (role: AppRole) => role === 'lead' || role === 'admin';
/* Merge to main: Team leads and Admins only. */
const canMergePromotion = (role: AppRole) =>
  role === 'lead' || role === 'admin';
/* QaAccessService.canManage: global project creators (admin, lead). */
const canManageChecklists = (role: AppRole) =>
  role === 'admin' || role === 'lead';

const OPEN_DEFECT_STATUSES: ReadonlyArray<QaRunItemStatus> = [
  'failed',
  'blocked',
  'returned_to_dev',
];

/* qa-automation-matching.ts. */
function itemSpecFile(testIdentifier: string): string {
  const cuts = [
    testIdentifier.indexOf(' › '),
    testIdentifier.indexOf(' > '),
  ].filter((i) => i >= 0);
  return (
    cuts.length === 0
      ? testIdentifier
      : testIdentifier.slice(0, Math.min(...cuts))
  ).trim();
}
function failureSpecFile(name: string): string {
  const cut = name.indexOf(' > ');
  return (cut === -1 ? name : name.slice(0, cut)).trim();
}
function normalizeSpecPath(path: string): string {
  const forward = path.replace(/\\/g, '/');
  return forward.startsWith('./') ? forward.slice(2) : forward;
}
function specFilesMatch(a: string, b: string): boolean {
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}
function stageLevel(
  status: QaStageAutomationWire['status'],
): 'passed' | 'failed' | 'unknown' {
  if (status === 'running' || status === 'cancelled') return 'unknown';
  return status === 'success' ? 'passed' : 'failed';
}
function matchAutomated(
  item: {
    verificationType: ChecklistVerificationType;
    testIdentifier: string | null;
  },
  automation: Required<QaRunAutomationWire>,
): QaAutomatedResultWire | null {
  if (item.verificationType === 'manual') return null;
  const source = item.verificationType;
  const stage = source === 'unit_test' ? 'quality' : 'verify';
  const report = stage === 'quality' ? automation.quality : automation.verify;
  const base = {
    source,
    stage,
    runId: report?.runId ?? null,
    runUrl: report?.runUrl ?? null,
    reportedAt: report?.reportedAt ?? null,
  } as const;
  const none = { matchedSpec: null, failure: null };
  if (!report) return { ...base, ...none, status: 'not_run', scope: 'stage' };
  if (report.status === 'running' || report.status === 'cancelled') {
    return { ...base, ...none, status: 'unknown', scope: 'stage' };
  }
  const tests = report.tests;
  if (source !== 'playwright' || !tests || tests.total === 0) {
    return {
      ...base,
      ...none,
      status: stageLevel(report.status),
      scope: 'stage',
    };
  }
  if (!item.testIdentifier) {
    return {
      ...base,
      ...none,
      status: tests.failed === 0 ? 'passed' : 'failed',
      scope: 'stage',
    };
  }
  const itemFile = normalizeSpecPath(itemSpecFile(item.testIdentifier));
  const match = (tests.failures ?? []).find((failure) =>
    specFilesMatch(
      normalizeSpecPath(failureSpecFile(failure.name ?? '')),
      itemFile,
    ),
  );
  if (match) {
    return {
      ...base,
      status: 'failed',
      scope: 'spec',
      matchedSpec: itemFile,
      failure: { name: match.name, message: match.message },
    };
  }
  if (tests.failed === 0)
    return { ...base, ...none, status: 'passed', scope: 'suite' };
  if (!tests.failuresTruncated)
    return {
      ...base,
      status: 'passed',
      scope: 'spec',
      matchedSpec: itemFile,
      failure: null,
    };
  return { ...base, ...none, status: 'unknown', scope: 'suite' };
}

/* ── The stateful mock backend ───────────────────────────────────────────── */

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
};

/** A Nest HttpException with a string message, as the client receives it. */
function nestError(status: number, message: string): HttpError {
  return new HttpError(status, {
    statusCode: status,
    message,
    error: REASONS[status],
  });
}

interface ItemRow {
  id: string;
  position: number;
  title: string;
  description: string | null;
  targetPersona: ChecklistTargetPersona;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  status: QaRunItemStatus;
  notes: string | null;
  defectSeverity: QaDefectSeverity | null;
  reproductionSteps: string | null;
  fixRequest: QaFixRequest | null;
  verifiedBy: QaActor | null;
  verifiedAt: string | null;
  rowVersion: number;
  updatedAt: number;
}

interface RunRow {
  id: string;
  checklistId: string;
  checklistName: string;
  checklistVersion: number;
  branch: string;
  commitSha: string;
  status: 'open' | 'signed_off';
  createdBy: QaActor;
  createdAt: string;
  updatedAt: string;
  items: ItemRow[];
  signoff: QaSignoff | null;
  /** The run exactly as it was signed, as the report serves it. */
  frozen: QaRun | null;
}

interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  accept: string | null;
  status: number;
  /** When the mock answered, for "the app has stopped asking". */
  at: number;
}

interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, unknown>;
}

interface ApiReply {
  status?: number;
  body: unknown;
  /** A 4xx the journey armed on purpose; recorded, not treated as a refusal. */
  expected?: boolean;
  /** Set for a non-JSON reply (the Markdown report). */
  contentType?: string;
}

type Handler = (match: RegExpExecArray, request: ApiRequest) => ApiReply;

/** PATCH /qa-checklists/:id/projects (legacy sharing; the UI no longer sends it). */
interface ChecklistProjectsPatch {
  add?: string[];
  remove?: string[];
}

interface RequirementItemRow {
  id: string;
  position: number;
  title: string;
  acceptanceCriteria: string | null;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  progress: RequirementProgress;
  progressBy: QaActor | null;
  progressAt: string | null;
  rowVersion: number;
  /** QA's test cases by category (ADR-0014, amendment 10); a System item has none. */
  testCategories: TestCategoryDefinition[];
}

/** One test case's result in one run, by the test case it was copied from. */
interface RunTestCaseResult {
  status: TestCaseStatus;
  notes: string | null;
  verifiedBy: QaActor | null;
  verifiedAt: string | null;
  rowVersion: number;
}

interface RequirementRow {
  id: string;
  kind: RequirementKind;
  deliveryProjectId: string;
  name: string;
  description: string | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  items: RequirementItemRow[];
}

interface ProjectRunItemRow {
  id: string;
  position: number;
  sourceItemId: string;
  requirementId: string;
  requirementName: string;
  requirementKind: RequirementKind;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  targetPersona: ChecklistTargetPersona;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  status: QaRunItemStatus;
  notes: string | null;
  defectSeverity: QaDefectSeverity | null;
  reproductionSteps: string | null;
  fixRequest: QaFixRequest | null;
  verifiedBy: QaActor | null;
  verifiedAt: string | null;
  rowVersion: number;
  /** Results of the story's test cases in this run, by source test case id. */
  testCaseResults: Record<string, RunTestCaseResult>;
  /** The Product owner's check after QA's sign-off (ADR-0014, amendment 12). */
  poAcceptance: {
    status: 'pending' | 'passed';
    acceptedBy: QaActor | null;
    acceptedAt: string | null;
  };
}

interface ProjectRunRow {
  id: string;
  deliveryProjectId: string;
  status: 'open' | 'signed_off';
  createdBy: QaActor;
  createdAt: string;
  /** The uat head of each repository when the run started. */
  heads: Array<{ projectId: string; repoFullName: string; sha: string }>;
  items: ProjectRunItemRow[];
  signoff: QaSignoff | null;
}

/** GET /delivery-projects/:dpId/qa-runs/:runId, as the backend (3147e15) sends it. */
interface ProjectQaRunWire {
  id: string;
  scope: 'project';
  deliveryProjectId: string;
  deliveryProjectName: string;
  status: 'open' | 'signed_off';
  createdBy: QaActor;
  createdAt: string;
  signoff: QaSignoff | null;
  repositories: HeadStatusWire[];
  stale: boolean;
  requirementsChanged: boolean;
  items: Array<
    Omit<ProjectRunItemRow, 'testCaseResults'> & {
      runId: string;
      progress: RequirementProgress | null;
      canUpdate: boolean;
      testCategories: RunTestCategory[];
    }
  >;
  permissions: {
    canSetVerification: boolean;
    canSignOff: boolean;
    canReopen: boolean;
    canDispatch: boolean;
    canManageTestCases: boolean;
    canRecordTestCases: boolean;
    canAccept: boolean;
  };
}

class QaMockBackend {
  readonly calls: RecordedCall[] = [];
  /** Every reply of 400 or more: each fails the journey (the UI must never send what the server refuses). */
  readonly refusals: string[] = [];
  readonly checklists: QaChecklist[] = [];
  readonly runs: RunRow[] = [];
  automation: Required<QaRunAutomationWire> = defaultAutomation();
  readonly folders: FolderRow[] = seedFolders();
  /** When set, the next move answers 409 as if someone else moved it first. */
  moveConflictArmed = false;
  /** 4xx replies a journey provoked on purpose (not refusals). */
  readonly expectedErrors: string[] = [];
  /** Set by a journey that types /activity on purpose as someone who may not read it. */
  activityForbiddenArmed = false;
  /** How GitHub answers the merge: merge it, or refuse with its own text (200, merged:false). */
  mergeMode: 'merge' | 'refuse' = 'merge';
  /** The open uat → main promotion PR; null once merged. */
  promotionPr: { number: number; url: string } | null = PROMOTION_PR;
  /** Project requirements (Product owners write them per Project). */
  readonly requirements: RequirementRow[] = [];
  /** Project-scope QA runs: one run covers every repository's uat head. */
  readonly projectRuns: ProjectRunRow[] = [];
  private seq = 0;
  private readonly routes: Array<[string, RegExp, Handler]>;

  constructor(
    readonly role: AppRole,
    private readonly qaCapability: 'enabled' | 'absent' = 'enabled',
    /** 'absent': a backend from before Project requirements — every new route 404s. */
    private readonly projectQa: 'enabled' | 'absent' = 'absent',
  ) {
    this.routes = this.buildRoutes();
  }

  get actor(): QaActor {
    const person = PEOPLE[this.role];
    return { id: person.id, login: person.login };
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  callsTo(method: string, pathPattern: RegExp): RecordedCall[] {
    return this.calls.filter(
      (call) => call.method === method && pathPattern.test(call.path),
    );
  }

  /* ── Seeding ── */

  seedChecklist(
    input: {
      name: string;
      description: string | null;
      items: QaChecklistItemInput[];
    },
    sharedProjectIds: string[],
  ): QaChecklist {
    const at = ago(3 * 24 * 60 * MINUTE);
    const checklist: QaChecklist = {
      id: this.nextId('checklist'),
      workspaceId: WORKSPACE.id,
      name: input.name,
      description: input.description,
      version: 1,
      archivedAt: null,
      createdBy: PEOPLE.lead.id,
      createdAt: at,
      updatedAt: at,
      items: this.toChecklistItems(input.items),
      sharedProjectIds,
    };
    this.checklists.push(checklist);
    return checklist;
  }

  /** As the repository stores them: a position per submitted index, absent optionals as null. */
  private toChecklistItems(
    items: QaChecklistItemInput[],
  ): QaChecklist['items'] {
    return items.map((item, index) => ({
      id: this.nextId('checklist-item'),
      position: index,
      title: item.title,
      description: item.description ?? null,
      targetPersona: item.targetPersona,
      verificationType: item.verificationType,
      testIdentifier: item.testIdentifier ?? null,
    }));
  }

  seedRun(checklist: QaChecklist, createdBy: QaActor): RunRow {
    const run = this.createRunRow(checklist, QA_BRANCH, UAT_SHA, createdBy);
    this.runs.push(run);
    return run;
  }

  /** Record what QA did to an item, the way PATCH would have left it. */
  seedItem(run: RunRow, position: number, patch: Partial<ItemRow>) {
    const item = run.items.find((entry) => entry.position === position);
    assert.ok(item, `run ${run.id} has no item at position ${position}`);
    Object.assign(item, { rowVersion: item.rowVersion + 1 }, patch);
  }

  /* ── Project requirements and Project QA runs ──
   *
   * Ported from the API (apps/api/src/modules/projects:
   * qa-requirements.service.ts, qa-project-runs.service.ts,
   * qa-run-access.rules.ts): who may manage, move Progress and verify; Passed
   * only on a Done item (QA_PROGRESS_NOT_DONE); severity for Failed and
   * Returned to dev; Returned to dev puts the source item back In progress;
   * row-version conflicts. With `projectQa: 'absent'` every route answers 404
   * like an older backend, and the UI must fall back to the repository
   * screens. */

  seedRequirement(
    deliveryProjectId: string,
    input: {
      kind: RequirementKind;
      name: string;
      items: Array<{
        title: string;
        acceptanceCriteria?: string;
        progress?: RequirementProgress;
      }>;
    },
  ): RequirementRow {
    const row: RequirementRow = {
      id: this.nextId('req'),
      kind: input.kind,
      deliveryProjectId,
      name: input.name,
      description: null,
      version: 1,
      archivedAt: null,
      createdAt: ago((10 - this.requirements.length) * 60 * MINUTE),
      items: input.items.map((item, position) =>
        this.requirementItemRow(item, position),
      ),
    };
    this.requirements.push(row);
    return row;
  }

  /**
   * A Project run on the Project's live requirements, as if the QA Team had
   * started it: every item Passed, and signed off with `verdict` when given;
   * `accepted` adds the Product owner's Pass on every item.
   */
  seedProjectRun(
    deliveryProjectId: string,
    options: {
      verdict?: QaVerdict;
      accepted?: boolean;
      failFirst?: boolean;
    } = {},
  ): ProjectRunRow {
    // The QA Team started it, whoever the journey signs in as.
    this.seedingAsQa = true;
    const reply = (() => {
      try {
        return this.startProjectRun(deliveryProjectId, {});
      } finally {
        this.seedingAsQa = false;
      }
    })();
    assert.equal(reply.status, 201, 'the seeded Project run started');
    const run = this.projectRuns.at(-1)!;
    for (const item of run.items) {
      Object.assign(item, {
        status: 'passed',
        verifiedBy: { id: PEOPLE.qa.id, login: PEOPLE.qa.login },
        verifiedAt: ago(30 * MINUTE),
      });
    }
    if (options.verdict) {
      run.status = 'signed_off';
      run.signoff = {
        id: this.nextId('signoff'),
        verdict: options.verdict,
        summary: 'Good job',
        conditions: null,
        signedBy: { id: PEOPLE.qa.id, login: PEOPLE.qa.login },
        signedAt: ago(20 * MINUTE),
      };
    }
    if (options.failFirst) {
      const [first] = run.items;
      Object.assign(first, {
        status: 'failed',
        notes: 'The saved card is not offered at checkout.',
        defectSeverity: 'major',
        rowVersion: first.rowVersion + 1,
      });
      const source = this.requirements
        .flatMap((row) => row.items)
        .find((entry) => entry.id === first.sourceItemId);
      if (source)
        Object.assign(source, {
          progress: 'in_progress',
          rowVersion: source.rowVersion + 1,
        });
    }
    if (options.accepted)
      for (const item of run.items)
        item.poAcceptance = {
          status: 'passed',
          acceptedBy: { id: PEOPLE.lead.id, login: PEOPLE.lead.login },
          acceptedAt: ago(10 * MINUTE),
        };
    return run;
  }

  private requirementItemRow(
    item: {
      title: string;
      acceptanceCriteria?: string | null;
      verificationType?: ChecklistVerificationType;
      testIdentifier?: string | null;
      progress?: RequirementProgress;
    },
    position: number,
  ): RequirementItemRow {
    return {
      id: this.nextId('req-item'),
      position,
      title: item.title,
      acceptanceCriteria: item.acceptanceCriteria ?? null,
      verificationType: item.verificationType ?? 'manual',
      testIdentifier: item.testIdentifier ?? null,
      progress: item.progress ?? 'todo',
      progressBy: null,
      progressAt: null,
      rowVersion: 1,
      testCategories: [],
    };
  }

  private absent(): ApiReply {
    return {
      status: 404,
      body: { statusCode: 404, message: 'Cannot GET', error: 'Not Found' },
      expected: true,
    };
  }

  private coded(status: number, code: string, message: string): HttpError {
    return new HttpError(status, {
      statusCode: status,
      code,
      message,
      error: REASONS[status],
    });
  }

  private requireRequirement(id: string): RequirementRow {
    const row = this.requirements.find((entry) => entry.id === id);
    if (!row) throw nestError(404, 'Requirement not found');
    return row;
  }

  private canManageRequirements(): boolean {
    return this.role === 'lead' || this.role === 'admin';
  }

  private canMoveProgress(): boolean {
    return (
      this.role === 'member' || this.role === 'lead' || this.role === 'admin'
    );
  }

  /** True only while a seed helper does what the QA Team did before the journey. */
  private seedingAsQa = false;

  private canVerify(): boolean {
    return (
      this.seedingAsQa ||
      this.role === 'qa' ||
      this.role === 'lead' ||
      this.role === 'admin'
    );
  }

  /** Test cases: the QA Team and admins (canManageTestCases / canRecordTestCaseResults). */
  private canWriteTestCases(): boolean {
    return this.role === 'qa' || this.role === 'admin';
  }

  /** The Product owner's check: a run QA signed off Approved or Conditional (canAcceptRunItems). */
  private mayAccept(run: ProjectRunRow): boolean {
    return (
      this.canManageRequirements() &&
      run.status === 'signed_off' &&
      (run.signoff?.verdict === 'APPROVED' ||
        run.signoff?.verdict === 'CONDITIONAL')
    );
  }

  private requirementItemWire(row: RequirementItemRow): RequirementItemWire {
    return { ...row, canSetProgress: this.canMoveProgress() };
  }

  private requirementWire(row: RequirementRow): RequirementWire {
    const items = [...row.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => this.requirementItemWire(item));
    const counts = { todo: 0, in_progress: 0, done: 0 };
    for (const item of items) counts[item.progress] += 1;
    return {
      id: row.id,
      kind: row.kind,
      deliveryProjectId: row.deliveryProjectId,
      workspaceId: WORKSPACE.id,
      name: row.name,
      description: row.description,
      version: row.version,
      archivedAt: row.archivedAt,
      createdBy: PEOPLE.lead.id,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
      legacyChecklistId: null,
      items,
      progressCounts: counts,
    };
  }

  private liveRequirements(deliveryProjectId: string): RequirementRow[] {
    return this.requirements
      .filter(
        (row) =>
          row.deliveryProjectId === deliveryProjectId &&
          row.archivedAt === null,
      )
      .sort((a, b) =>
        a.kind === b.kind
          ? a.createdAt.localeCompare(b.createdAt)
          : a.kind === 'functional'
            ? -1
            : 1,
      );
  }

  private projectRequirements(deliveryProjectId: string): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const folder = this.requireFolder(deliveryProjectId);
    const body: ProjectRequirementsResponseWire = {
      deliveryProject: {
        id: folder.id,
        name: folder.name,
        groupId: WORKSPACE.id,
      },
      requirements: this.liveRequirements(folder.id).map((row) =>
        this.requirementWire(row),
      ),
      permissions: {
        canManage: this.canManageRequirements(),
        canSetProgress: this.canMoveProgress(),
      },
    };
    return { body };
  }

  private createRequirement(
    deliveryProjectId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    this.requireFolder(deliveryProjectId);
    if (!this.canManageRequirements())
      throw this.coded(
        403,
        'REQUIREMENT_MANAGE_FORBIDDEN',
        'Only leads and admins manage requirements',
      );
    const kind =
      body.kind === 'functional' || body.kind === 'system' ? body.kind : null;
    if (!kind)
      throw this.coded(
        400,
        'REQUIREMENT_KIND_INVALID',
        'kind must be functional or system',
      );
    const name = String(body.name ?? '').trim();
    if (
      this.liveRequirements(deliveryProjectId).some(
        (row) =>
          row.kind === kind && row.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw this.coded(
        409,
        'REQUIREMENT_NAME_TAKEN',
        'A requirement with that name exists',
      );
    }
    const items = Array.isArray(body.items)
      ? (body.items as Array<{ title: string; acceptanceCriteria?: string }>)
      : [];
    const row = this.seedRequirement(deliveryProjectId, { kind, name, items });
    row.description =
      typeof body.description === 'string' ? body.description : null;
    row.createdAt = new Date().toISOString();
    return { status: 201, body: this.requirementWire(row) };
  }

  /**
   * POST /delivery-projects/:dpId/requirements/batch — 1..20 of one kind in
   * ONE request, all or nothing: a name used twice in the batch is 400
   * REQUIREMENT_BATCH_DUPLICATE_NAME, one the Project already has is 409
   * REQUIREMENT_NAME_TAKEN, each with the offending `index`.
   */
  private createRequirementBatch(
    deliveryProjectId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    this.requireFolder(deliveryProjectId);
    if (!this.canManageRequirements())
      throw this.coded(
        403,
        'REQUIREMENT_MANAGE_FORBIDDEN',
        'Only leads and admins manage requirements',
      );
    const kind =
      body.kind === 'functional' || body.kind === 'system' ? body.kind : null;
    const entries = Array.isArray(body.requirements)
      ? (body.requirements as Array<Record<string, unknown>>)
      : [];
    const names = entries.map((entry) => String(entry?.name ?? '').trim());
    if (
      !kind ||
      entries.length < 1 ||
      entries.length > 20 ||
      names.some((name) => !name)
    ) {
      throw this.coded(
        400,
        'REQUIREMENT_BATCH_INVALID',
        'A batch is 1 to 20 named requirements of one kind',
      );
    }
    const lower = names.map((name) => name.toLowerCase());
    const duplicate = lower.findIndex(
      (name, index) => lower.indexOf(name) !== index,
    );
    if (duplicate >= 0) {
      throw new HttpError(400, {
        statusCode: 400,
        code: 'REQUIREMENT_BATCH_DUPLICATE_NAME',
        message: 'Two requirements share a name',
        index: duplicate,
        error: REASONS[400],
      });
    }
    const taken = lower.findIndex((name) =>
      this.liveRequirements(deliveryProjectId).some(
        (row) => row.kind === kind && row.name.toLowerCase() === name,
      ),
    );
    if (taken >= 0) {
      throw new HttpError(409, {
        statusCode: 409,
        code: 'REQUIREMENT_NAME_TAKEN',
        message: 'A requirement with that name exists',
        index: taken,
        error: REASONS[409],
      });
    }
    const created = entries.map((entry, index) => {
      const items = Array.isArray(entry.items)
        ? (entry.items as Array<{ title: string; acceptanceCriteria?: string }>)
        : [];
      const row = this.seedRequirement(deliveryProjectId, {
        kind,
        name: names[index],
        items,
      });
      row.description =
        typeof entry.description === 'string' ? entry.description : null;
      row.createdAt = new Date(Date.now() + index).toISOString();
      return this.requirementWire(row);
    });
    return { status: 201, body: { requirements: created } };
  }

  /** Active Features: what GET /groups/:id/project-folders reports as `featureCount`. */
  private featureCount(deliveryProjectId: string): number {
    return this.liveRequirements(deliveryProjectId).filter(
      (row) => row.kind === 'functional',
    ).length;
  }

  private addRequirementItem(
    requirementId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const row = this.requireRequirement(requirementId);
    if (!this.canManageRequirements())
      throw this.coded(
        403,
        'REQUIREMENT_MANAGE_FORBIDDEN',
        'Only leads and admins manage requirements',
      );
    const item = this.requirementItemRow(
      body as { title: string },
      row.items.length,
    );
    row.items.push(item);
    return { status: 201, body: this.requirementItemWire(item) };
  }

  private setProgress(
    requirementId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const item = this.requireRequirement(requirementId).items.find(
      (entry) => entry.id === itemId,
    );
    if (!item) throw nestError(404, 'Requirement item not found');
    if (!this.canMoveProgress())
      throw this.coded(403, 'PROGRESS_FORBIDDEN', 'QA cannot set Progress');
    if (body.expectedRowVersion !== item.rowVersion)
      throw this.coded(409, 'REQUIREMENT_ITEM_STALE', 'The item changed');
    const progress = body.progress as RequirementProgress;
    Object.assign(item, {
      progress,
      progressBy: this.actor,
      progressAt: new Date().toISOString(),
      rowVersion: item.rowVersion + 1,
    });
    return {
      body: {
        item: this.requirementItemWire(item),
        readyForQaNotified: progress === 'done',
      },
    };
  }

  private requirementsOverview(): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    return {
      body: {
        groups: this.folders
          .filter((folder) => !folder.archived)
          .map((folder) => ({
            deliveryProject: { id: folder.id, name: folder.name },
            requirements: this.liveRequirements(folder.id).map((row) => ({
              id: row.id,
              kind: row.kind,
              name: row.name,
              archivedAt: null,
            })),
          })),
        unassigned: [],
        permissions: { canManage: this.canManageRequirements() },
      },
    };
  }

  private folderHeads(
    folder: FolderRow,
  ): Array<{ projectId: string; repoFullName: string; sha: string }> {
    return folder.repositories
      .filter((repo) => !repo.archived && repo.projectId)
      .map((repo) => ({
        projectId: repo.projectId as string,
        repoFullName: repo.repoFullName ?? repo.name,
        sha: UAT_SHA,
      }));
  }

  private projectRunWire(run: ProjectRunRow): ProjectQaRunWire {
    const folder = this.requireFolder(run.deliveryProjectId);
    const now = this.folderHeads(folder);
    const repositories: HeadStatusWire[] = now.map((head) => {
      const captured =
        run.heads.find((entry) => entry.projectId === head.projectId) ?? null;
      return {
        projectId: head.projectId,
        repoFullName: head.repoFullName,
        runSha: captured?.sha ?? null,
        currentSha: head.sha,
        moved: captured?.sha !== head.sha,
      };
    });
    const items = run.items.map((item) => {
      const source =
        this.requirements
          .flatMap((row) => row.items)
          .find((entry) => entry.id === item.sourceItemId) ?? null;
      const { testCaseResults: _results, ...fields } = item;
      return {
        ...fields,
        runId: run.id,
        progress: source?.progress ?? null,
        canUpdate: this.canVerify(),
        testCategories: this.runTestCategories(item, source),
      };
    });
    return {
      id: run.id,
      scope: 'project',
      deliveryProjectId: run.deliveryProjectId,
      deliveryProjectName: folder.name,
      status: run.status,
      createdBy: run.createdBy,
      createdAt: run.createdAt,
      signoff: run.signoff,
      repositories,
      stale: repositories.some((head) => head.moved),
      requirementsChanged: false,
      items,
      permissions: {
        canSetVerification: run.status === 'open' && this.canVerify(),
        canSignOff: run.status === 'open' && this.canVerify(),
        canReopen: run.status !== 'open' && this.canManageRequirements(),
        canDispatch: run.status === 'open' && this.canVerify(),
        canManageTestCases: run.status === 'open' && this.canWriteTestCases(),
        canRecordTestCases: run.status === 'open' && this.canWriteTestCases(),
        canAccept: this.mayAccept(run),
      },
    };
  }

  private requireProjectRun(runId: string): ProjectRunRow {
    const run = this.projectRuns.find((entry) => entry.id === runId);
    if (!run) throw nestError(404, 'QA run not found');
    return run;
  }

  private currentProjectRun(deliveryProjectId: string): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const folder = this.requireFolder(deliveryProjectId);
    const run =
      this.projectRuns
        .filter((entry) => entry.deliveryProjectId === folder.id)
        .at(-1) ?? null;
    const heads = this.folderHeads(folder).map((head) => ({
      projectId: head.projectId,
      repoFullName: head.repoFullName,
      runSha: run ? head.sha : null,
      currentSha: head.sha,
      moved: false,
    }));
    return {
      body: { run: run ? this.projectRunWire(run) : null, heads, stale: false },
    };
  }

  private startProjectRun(
    deliveryProjectId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const folder = this.requireFolder(deliveryProjectId);
    assert.deepEqual(
      body,
      {},
      'a Project run is started with no body: the server reads the heads',
    );
    if (!this.canVerify()) throw nestError(403, 'Insufficient role');
    const requirements = this.liveRequirements(folder.id);
    if (requirements.length === 0)
      throw this.coded(
        409,
        'QA_NO_REQUIREMENTS',
        'This Project has no requirements',
      );
    let position = 0;
    const run: ProjectRunRow = {
      id: this.nextId('prun'),
      deliveryProjectId: folder.id,
      status: 'open',
      createdBy: this.actor,
      createdAt: new Date().toISOString(),
      heads: this.folderHeads(folder),
      signoff: null,
      items: requirements.flatMap((row) =>
        [...row.items]
          .sort((a, b) => a.position - b.position)
          .map((item) => ({
            id: this.nextId('prun-item'),
            position: position++,
            sourceItemId: item.id,
            requirementId: row.id,
            requirementName: row.name,
            requirementKind: row.kind,
            title: item.title,
            description: null,
            acceptanceCriteria: item.acceptanceCriteria,
            targetPersona: 'all' as const,
            verificationType: item.verificationType,
            testIdentifier: item.testIdentifier,
            status: 'pending' as QaRunItemStatus,
            notes: null,
            defectSeverity: null,
            reproductionSteps: null,
            fixRequest: null,
            verifiedBy: null,
            verifiedAt: null,
            rowVersion: 1,
            testCaseResults: {},
            poAcceptance: {
              status: 'pending' as const,
              acceptedBy: null,
              acceptedAt: null,
            },
          })),
      ),
    };
    this.projectRuns.push(run);
    return {
      status: 201,
      body: { created: true, run: this.projectRunWire(run) },
    };
  }

  /** The story behind a run item, by its source item id. */
  private sourceOf(item: ProjectRunItemRow): RequirementItemRow | null {
    return (
      this.requirements
        .flatMap((row) => row.items)
        .find((entry) => entry.id === item.sourceItemId) ?? null
    );
  }

  /** An open run lists the story's live test cases with this run's results (qa-run-test-cases.ts). */
  private runTestCategories(
    item: ProjectRunItemRow,
    source: RequirementItemRow | null,
  ): RunTestCategory[] {
    return (source?.testCategories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      rowVersion: category.rowVersion,
      testCases: category.testCases.map((testCase) => {
        const result = item.testCaseResults[testCase.id];
        return {
          id: `run-${item.id}-${testCase.id}`,
          sourceTestCaseId: testCase.id,
          position: testCase.position,
          title: testCase.title,
          expectedResult: testCase.expectedResult,
          status: result?.status ?? 'pending',
          notes: result?.notes ?? null,
          verifiedBy: result?.verifiedBy ?? null,
          verifiedAt: result?.verifiedAt ?? null,
          rowVersion: result?.rowVersion ?? 1,
          definitionRowVersion: testCase.rowVersion,
        };
      }),
    }));
  }

  private openTestCases(
    item: ProjectRunItemRow,
    source: RequirementItemRow | null,
  ): number {
    return this.runTestCategories(item, source)
      .flatMap((category) => category.testCases)
      .filter(
        (testCase) =>
          testCase.status !== 'passed' && testCase.status !== 'not_applicable',
      ).length;
  }

  private requireStory(
    requirementId: string,
    itemId: string,
  ): { row: RequirementRow; item: RequirementItemRow } {
    const row = this.requirements.find((entry) => entry.id === requirementId);
    const item = row?.items.find((entry) => entry.id === itemId);
    if (!row || !item) throw nestError(404, 'Requirement item not found');
    if (!this.canWriteTestCases())
      throw this.coded(
        403,
        'TEST_CASE_MANAGE_FORBIDDEN',
        'Only the QA Team or an admin may write test cases.',
      );
    if (row.kind !== 'functional')
      throw this.coded(
        409,
        'TEST_CASES_STORY_ONLY',
        'Test cases belong to the User stories of a Feature.',
      );
    return { row, item };
  }

  /** POST /requirements/:id/items/:itemId/test-categories */
  private addTestCategory(
    requirementId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    const { item } = this.requireStory(requirementId, itemId);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw nestError(400, 'A category needs a name.');
    item.testCategories.push({
      id: this.nextId('tcat'),
      position: item.testCategories.length,
      name,
      rowVersion: 1,
      testCases: [],
    });
    return { status: 201, body: { testCategories: item.testCategories } };
  }

  /** POST /requirements/:id/items/:itemId/test-categories/:categoryId/test-cases */
  private addTestCase(
    requirementId: string,
    itemId: string,
    categoryId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    const { item } = this.requireStory(requirementId, itemId);
    const category = item.testCategories.find(
      (entry) => entry.id === categoryId,
    );
    if (!category) throw nestError(404, 'Test case category not found');
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) throw nestError(400, 'A test case needs a title.');
    category.testCases.push({
      id: this.nextId('tcase'),
      position: category.testCases.length,
      title,
      expectedResult:
        typeof body.expectedResult === 'string' ? body.expectedResult : null,
      rowVersion: 1,
    });
    return { status: 201, body: { testCategories: item.testCategories } };
  }

  /** PATCH /delivery-projects/:id/qa-runs/:runId/items/:itemId/test-cases/:testCaseId */
  private setTestCaseResult(
    runId: string,
    itemId: string,
    runTestCaseId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    const run = this.requireProjectRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    if (run.status !== 'open')
      throw nestError(
        409,
        'This run is signed off. Reopen it to make changes.',
      );
    if (!this.canWriteTestCases())
      throw this.coded(
        403,
        'TEST_CASE_RESULT_FORBIDDEN',
        'Only the QA Team or an admin may record test case results.',
      );
    const testCase = this.runTestCategories(item, this.sourceOf(item))
      .flatMap((category) => category.testCases)
      .find((entry) => entry.id === runTestCaseId);
    if (!testCase?.sourceTestCaseId)
      throw nestError(404, 'Test case not found');
    if (body.expectedRowVersion !== testCase.rowVersion)
      throw this.coded(
        409,
        'QA_TEST_CASE_STALE',
        'This test case has changed; reload and try again.',
      );
    item.testCaseResults[testCase.sourceTestCaseId] = {
      status: (body.status as TestCaseStatus | undefined) ?? testCase.status,
      notes:
        'notes' in body
          ? ((body.notes as string | null) ?? null)
          : testCase.notes,
      verifiedBy: this.actor,
      verifiedAt: new Date().toISOString(),
      rowVersion: (testCase.rowVersion ?? 1) + 1,
    };
    return { body: this.projectRunWire(run) };
  }

  private setVerification(
    runId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const run = this.requireProjectRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    if (!this.canVerify())
      throw this.coded(
        403,
        'VERIFICATION_FORBIDDEN',
        'Developers cannot set Verification',
      );
    const status = body.status as QaRunItemStatus;
    // Pending, Passed or Failed only: Failed returns the story to the Developers.
    if (!['pending', 'passed', 'failed'].includes(status))
      throw this.coded(
        400,
        'QA_VERIFICATION_STATUS_INVALID',
        `${String(status)} is not a Verification`,
      );
    if (body.expectedRowVersion !== item.rowVersion)
      throw this.coded(
        409,
        'QA_ITEM_STALE',
        'This item has changed; reload and try again.',
      );
    const source =
      this.requirements
        .flatMap((row) => row.items)
        .find((entry) => entry.id === item.sourceItemId) ?? null;
    const openCases = this.openTestCases(item, source);
    if (status === 'passed' && openCases > 0)
      throw this.coded(
        409,
        'QA_TEST_CASES_OPEN',
        `${String(openCases)} test case${openCases === 1 ? ' is' : 's are'} still pending, failed or blocked. Pass them (or mark them not applicable) before passing the story.`,
      );
    if (status === 'passed' && source?.progress !== 'done') {
      throw this.coded(
        409,
        'QA_PROGRESS_NOT_DONE',
        'A developer marks this Done before QA can pass it.',
      );
    }
    const severity =
      'defectSeverity' in body
        ? (body.defectSeverity as QaDefectSeverity | null)
        : item.defectSeverity;
    if (status === 'failed' && !severity) {
      throw nestError(
        400,
        'A defect severity is required to mark this item failed.',
      );
    }
    Object.assign(item, {
      status,
      notes: 'notes' in body ? (body.notes as string | null) : item.notes,
      defectSeverity: severity,
      reproductionSteps:
        'reproductionSteps' in body
          ? (body.reproductionSteps as string | null)
          : item.reproductionSteps,
      verifiedBy: this.actor,
      verifiedAt: new Date().toISOString(),
      rowVersion: item.rowVersion + 1,
    });
    if (status === 'failed' && source)
      Object.assign(source, {
        progress: 'in_progress',
        rowVersion: source.rowVersion + 1,
      });
    return { body: this.projectRunWire(run) };
  }

  /**
   * PATCH .../items/:itemId/acceptance, as qa-project-runs.service.ts
   * acceptItem: Passed records the Product owner's acceptance; Failed needs
   * notes, reopens the run and fails the story back to the Developers.
   */
  private acceptItem(
    runId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const run = this.requireProjectRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    if (!this.canManageRequirements())
      throw nestError(
        403,
        'Only a Product owner or an admin may accept a signed-off run.',
      );
    if (run.status !== 'signed_off')
      throw nestError(
        409,
        'QA has not signed this run off yet: the Product owner checks it after QA.',
      );
    if (!this.mayAccept(run))
      throw nestError(
        409,
        'QA signed this run off as Rejected: there is nothing to accept.',
      );
    if (body.expectedRowVersion !== item.rowVersion)
      throw this.coded(
        409,
        'QA_ITEM_STALE',
        'This item has changed; reload and try again.',
      );
    if (body.decision === 'passed') {
      Object.assign(item, {
        poAcceptance: {
          status: 'passed',
          acceptedBy: this.actor,
          acceptedAt: new Date().toISOString(),
        },
        rowVersion: item.rowVersion + 1,
      });
      return { body: this.projectRunWire(run) };
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (!notes)
      throw nestError(
        400,
        'Say what is wrong, so the Developers know what to fix.',
      );
    run.status = 'open';
    run.signoff = null;
    Object.assign(item, {
      status: 'failed',
      notes,
      defectSeverity: item.defectSeverity ?? 'major',
      rowVersion: item.rowVersion + 1,
    });
    const source = this.requirements
      .flatMap((row) => row.items)
      .find((entry) => entry.id === item.sourceItemId);
    if (source)
      Object.assign(source, {
        progress: 'in_progress',
        rowVersion: source.rowVersion + 1,
      });
    return { body: this.projectRunWire(run) };
  }

  private signoffProjectRun(
    runId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const run = this.requireProjectRun(runId);
    const verdict = body.verdict as QaVerdict;
    const failed = run.items.filter((item) => item.status === 'failed').length;
    if (failed > 0)
      throw this.coded(
        409,
        'QA_RUN_OPEN_DEFECTS',
        `${String(failed)} item${failed === 1 ? ' is' : 's are'} failed, blocked or returned to dev. Sign off once QA has verified the fix${failed === 1 ? '' : 'es'}.`,
      );
    const openCases = run.items.reduce(
      (sum, item) => sum + this.openTestCases(item, this.sourceOf(item)),
      0,
    );
    if (verdict === 'APPROVED' && openCases > 0)
      throw this.coded(
        409,
        'QA_TEST_CASES_OPEN',
        `${String(openCases)} test case${openCases === 1 ? ' is' : 's are'} still pending, failed or blocked. An APPROVED sign-off needs every test case passed or not applicable.`,
      );
    if (
      verdict === 'APPROVED' &&
      run.items.some((item) => item.status !== 'passed')
    ) {
      throw nestError(
        409,
        'Every item must be passed before the run can be approved',
      );
    }
    run.status = 'signed_off';
    run.signoff = {
      id: this.nextId('signoff'),
      verdict,
      summary: typeof body.summary === 'string' ? body.summary : null,
      conditions: typeof body.conditions === 'string' ? body.conditions : null,
      signedBy: this.actor,
      signedAt: new Date().toISOString(),
    };
    return { body: this.projectRunWire(run) };
  }

  private projectMyItems(deliveryProjectId: string): ApiReply {
    if (this.projectQa === 'absent') return this.absent();
    const folder = this.requireFolder(deliveryProjectId);
    const run =
      this.projectRuns
        .filter(
          (entry) =>
            entry.deliveryProjectId === folder.id && entry.status === 'open',
        )
        .at(-1) ?? null;
    const buckets: Record<
      'returned' | 'inProgress' | 'todo' | 'readyForQa',
      unknown[]
    > = { returned: [], inProgress: [], todo: [], readyForQa: [] };
    for (const row of this.liveRequirements(folder.id)) {
      for (const item of row.items) {
        const runItem =
          run?.items.find((entry) => entry.sourceItemId === item.id) ?? null;
        const entry = {
          requirement: { id: row.id, name: row.name, kind: row.kind },
          item: this.requirementItemWire(item),
          runId: runItem && run ? run.id : null,
          runItem:
            runItem && run
              ? {
                  ...runItem,
                  runId: run.id,
                  progress: item.progress,
                  canUpdate: this.canVerify(),
                }
              : null,
        };
        if (runItem && OPEN_DEFECT_STATUSES.includes(runItem.status))
          buckets.returned.push(entry);
        else if (item.progress === 'in_progress')
          buckets.inProgress.push(entry);
        else if (item.progress === 'todo') buckets.todo.push(entry);
        else if (runItem?.status === 'pending' || !runItem)
          buckets.readyForQa.push(entry);
      }
    }
    return { body: buckets };
  }

  /* ── Routing ── */

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    let body: Record<string, unknown> = {};
    try {
      body = (request.postDataJSON() as Record<string, unknown> | null) ?? {};
    } catch {
      body = {};
    }
    const apiRequest: ApiRequest = {
      method: request.method(),
      path,
      query: url.searchParams,
      body,
    };
    const reply = this.dispatch(apiRequest);
    const status = reply.status ?? 200;
    this.calls.push({
      method: apiRequest.method,
      path,
      query: url.searchParams,
      body,
      accept: (await request.allHeaders()).accept ?? null,
      status,
      at: Date.now(),
    });
    if (status >= 400) {
      const line = `${status} ${apiRequest.method} ${path}${url.search} ${JSON.stringify(reply.body)}`;
      if (reply.expected) this.expectedErrors.push(line);
      else this.refusals.push(line);
    }
    if (reply.contentType)
      return text(route, status, String(reply.body), reply.contentType);
    return json(route, reply.body, status);
  }

  private dispatch(request: ApiRequest): ApiReply {
    for (const [method, pattern, handler] of this.routes) {
      if (method !== request.method) continue;
      const match = pattern.exec(request.path);
      if (!match) continue;
      try {
        return handler(match, request);
      } catch (error) {
        if (error instanceof HttpError)
          return { status: error.status, body: error.body };
        throw error;
      }
    }
    return {
      status: 404,
      body: `No E2E fixture for ${request.method} ${request.path}`,
      contentType: 'text/plain',
    };
  }

  private buildRoutes(): Array<[string, RegExp, Handler]> {
    const P = '([^/]+)';
    return [
      ['GET', /^\/auth\/me$/, () => ({ body: this.authMe() })],
      ['GET', /^\/capabilities$/, () => ({ body: this.capabilities() })],
      ['GET', /^\/workspaces\/me$/, () => ({ body: this.workspacesMe() })],
      ['GET', /^\/groups$/, () => ({ body: [this.group()] })],
      // The Teams page is the header team's members.
      [
        'GET',
        new RegExp(`^/groups/${P}/members$`),
        (m) => ({ body: this.groupMembers(m[1]) }),
      ],
      [
        'GET',
        new RegExp(`^/groups/${P}/activity$`),
        (m) => this.groupActivity(m[1]),
      ],
      [
        'GET',
        /^\/notifications$/,
        () => ({
          body: {
            enabled: true,
            unreadCount: 0,
            items: [],
          } satisfies NotificationsResponse,
        }),
      ],
      // The live stream: open, then quiet (the API sends a heartbeat every 15 s).
      [
        'GET',
        /^\/notifications\/stream$/,
        () => ({ body: ': connected\n\n', contentType: 'text/event-stream' }),
      ],
      // The providers the API registers. On-prem is listed but off, as on a
      // server with no enrolled machine.
      [
        'GET',
        /^\/deployment-providers$/,
        () => ({
          body: {
            providers: [
              {
                id: 'vercel',
                label: 'Vercel',
                enabled: true,
                supportedSlots: ['frontend'],
                capabilities: HOSTED_PROVIDER_CAPABILITIES,
              },
              {
                id: 'render',
                label: 'Render',
                enabled: true,
                supportedSlots: ['frontend', 'backend'],
                capabilities: HOSTED_PROVIDER_CAPABILITIES,
              },
              {
                id: 'onprem-compose',
                label: 'On-prem',
                enabled: false,
                reason: 'On-prem hosting is not enabled on this server.',
                supportedSlots: ['frontend', 'backend'],
                capabilities: ONPREM_PROVIDER_CAPABILITIES,
              },
            ],
          },
        }),
      ],
      // The API always has an active Iteration (it starts the first one on
      // demand); merges deliver it.
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/iterations/current$`),
        (m) => ({ body: this.currentIteration(m[1]) }),
      ],
      // Every Project screen reads its team to-dos; these journeys add none.
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/todos$`),
        () => ({ body: { todos: [], assignees: [] } }),
      ],
      // Folded panels that read only when opened: QA history and coverage.
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/qa-history$`),
        () => ({ body: { events: [], nextCursor: null } }),
      ],
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/semantic-coverage$`),
        () => ({ body: { features: [] } }),
      ],
      // No CI run yet for the repository.
      ['GET', /^\/ci\/runs$/, () => ({ body: { runs: [] } })],
      // A repository with nothing deployed or released yet.
      [
        'GET',
        new RegExp(`^/projects/${P}/deployment-targets$`),
        () => ({ body: [] }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/environments$`),
        () => ({ body: [] }),
      ],
      ['GET', new RegExp(`^/projects/${P}/releases$`), () => ({ body: [] })],
      [
        'GET',
        new RegExp(`^/projects/${P}/workspace/runs$`),
        (m) => ({
          body: {
            repoFullName: this.requireProject(m[1]).repoFullName,
            actionsUrl: `https://github.com/${this.requireProject(m[1]).repoFullName}/actions`,
            runs: [],
          },
        }),
      ],
      // ALPHACI's browser tests not added yet; the Developers may add them on dev.
      [
        'GET',
        new RegExp(`^/projects/${P}/workspace/browser-tests$`),
        () => ({
          body: {
            installed: false,
            branch: 'dev',
            missingFiles: ['playwright.config.ts', 'tests/e2e/smoke.spec.ts'],
            presentFiles: [],
            hasLockfile: true,
            playwrightVersion: null,
            frontend: true,
            canAdd: this.role === 'member' || this.role === 'admin',
            reason: null,
            visual: null,
            ownTests: { count: 0, paths: [] },
          },
        }),
      ],
      [
        'GET',
        new RegExp(`^/workspaces/${P}/members$`),
        (m) => ({
          body: (Object.keys(PEOPLE) as AppRole[]).map((role) => ({
            id: `member-${role}`,
            workspaceId: m[1],
            userId: PEOPLE[role].id,
            role: role === 'admin' ? 'admin' : 'member',
            login: PEOPLE[role].login,
            name: PEOPLE[role].name,
            email: PEOPLE[role].email,
            avatarUrl: null,
            createdAt: ago(30 * 24 * 60 * MINUTE),
          })),
        }),
      ],
      // The project page reads only enforcedOrg (to label repositories outside it "External").
      [
        'GET',
        /^\/catalog\/project-options$/,
        () => ({ body: this.projectOptions() }),
      ],
      [
        'GET',
        /^\/projects$/,
        (_m, req) => ({
          body: { items: this.projectsFor(req.query.get('workspaceId')) },
        }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/overview$`),
        (m) => ({ body: this.overview(m[1]) }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/previews$`),
        (m) => ({ body: this.previews(m[1]) }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/audit$`),
        (m, req) => this.audit(m[1], req.query),
      ],
      [
        'POST',
        new RegExp(`^/projects/${P}/audit/sync$`),
        (m) => this.syncAudit(m[1]),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/commits$`),
        (m, req) => this.commits(m[1], req.query),
      ],
      // Project requirements and Project QA runs (404 on an older backend)
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/requirements$`),
        (m) => this.projectRequirements(m[1]),
      ],
      [
        'POST',
        new RegExp(`^/delivery-projects/${P}/requirements$`),
        (m, req) => this.createRequirement(m[1], req.body),
      ],
      [
        'POST',
        new RegExp(`^/delivery-projects/${P}/requirements/batch$`),
        (m, req) => this.createRequirementBatch(m[1], req.body),
      ],
      [
        'POST',
        new RegExp(`^/requirements/${P}/items$`),
        (m, req) => this.addRequirementItem(m[1], req.body),
      ],
      [
        'PATCH',
        new RegExp(`^/requirements/${P}/items/${P}/progress$`),
        (m, req) => this.setProgress(m[1], m[2], req.body),
      ],
      [
        'GET',
        new RegExp(`^/workspaces/${P}/qa-requirements/overview$`),
        () => this.requirementsOverview(),
      ],
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/qa/my-items$`),
        (m) => this.projectMyItems(m[1]),
      ],
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}/qa-runs/current$`),
        (m) => this.currentProjectRun(m[1]),
      ],
      [
        'POST',
        new RegExp(`^/delivery-projects/${P}/qa-runs$`),
        (m, req) => this.startProjectRun(m[1], req.body),
      ],
      [
        'PATCH',
        new RegExp(`^/delivery-projects/${P}/qa-runs/${P}/items/${P}$`),
        (m, req) => this.setVerification(m[2], m[3], req.body),
      ],
      [
        'POST',
        new RegExp(`^/delivery-projects/${P}/qa-runs/${P}/signoff$`),
        (m, req) => this.signoffProjectRun(m[2], req.body),
      ],
      [
        'PATCH',
        new RegExp(
          `^/delivery-projects/${P}/qa-runs/${P}/items/${P}/acceptance$`,
        ),
        (m, req) => this.acceptItem(m[2], m[3], req.body),
      ],
      [
        'PATCH',
        new RegExp(
          `^/delivery-projects/${P}/qa-runs/${P}/items/${P}/test-cases/${P}$`,
        ),
        (m, req) => this.setTestCaseResult(m[2], m[3], m[4], req.body),
      ],
      [
        'POST',
        new RegExp(`^/requirements/${P}/items/${P}/test-categories$`),
        (m, req) => this.addTestCategory(m[1], m[2], req.body),
      ],
      [
        'POST',
        new RegExp(
          `^/requirements/${P}/items/${P}/test-categories/${P}/test-cases$`,
        ),
        (m, req) => this.addTestCase(m[1], m[2], m[3], req.body),
      ],
      // Checklists
      [
        'GET',
        new RegExp(`^/workspaces/${P}/qa-checklists$`),
        (m, req) => ({ body: this.listWorkspaceChecklists(m[1], req.query) }),
      ],
      [
        'POST',
        new RegExp(`^/workspaces/${P}/qa-checklists$`),
        (m, req) => ({
          status: 201,
          body: this.createChecklist(m[1], req.body),
        }),
      ],
      [
        'GET',
        new RegExp(`^/qa-checklists/${P}$`),
        (m) => ({ body: this.requireChecklist(m[1]) }),
      ],
      [
        'PUT',
        new RegExp(`^/qa-checklists/${P}/projects$`),
        (m, req) => ({ body: this.shareChecklist(m[1], req.body) }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/qa-checklists$`),
        (m) => ({ body: this.listProjectChecklists(m[1]) }),
      ],
      // Runs
      [
        'GET',
        new RegExp(`^/projects/${P}/qa-runs/current$`),
        (_m, req) => ({ body: this.currentRun(req.query) }),
      ],
      [
        'POST',
        new RegExp(`^/projects/${P}/qa-runs$`),
        (_m, req) => this.createRun(req.body),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/qa-runs/${P}$`),
        (m) => ({ body: this.assembleRun(this.requireRun(m[2])) }),
      ],
      [
        'PATCH',
        new RegExp(`^/projects/${P}/qa-runs/${P}/items/${P}$`),
        (m, req) => ({ body: this.updateItem(m[2], m[3], req.body) }),
      ],
      [
        'POST',
        new RegExp(`^/projects/${P}/qa-runs/${P}/items/${P}/request-retest$`),
        (m, req) => ({ body: this.requestRetest(m[2], m[3], req.body) }),
      ],
      [
        'POST',
        new RegExp(`^/projects/${P}/qa-runs/${P}/signoff$`),
        (m, req) => ({ body: this.signoff(m[2], req.body) }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/qa-runs/${P}/report$`),
        (m, req) => this.report(m[2], req.query.get('format')),
      ],
      [
        'POST',
        new RegExp(`^/projects/${P}/qa-runs/${P}/automation/dispatch$`),
        (m) => ({ status: 202, body: this.dispatchAutomation(m[2]) }),
      ],
      [
        'GET',
        new RegExp(`^/projects/${P}/qa-returned-items$`),
        () => ({
          body: {
            items: this.returnedItems(),
          } satisfies QaReturnedItemsResponse,
        }),
      ],
      // Project folders (the Teams project explorer)
      [
        'GET',
        new RegExp(`^/groups/${P}/project-folders$`),
        (m) => ({ body: this.projectFolders(m[1]) }),
      ],
      // The project page's Project identity and repository switch.
      [
        'GET',
        new RegExp(`^/projects/${P}/folder$`),
        (m) => ({ body: this.projectFolder(m[1]) }),
      ],
      [
        'POST',
        new RegExp(`^/groups/${P}/projects$`),
        (m, req) => ({ status: 201, body: this.createFolder(m[1], req.body) }),
      ],
      [
        'POST',
        new RegExp(`^/repositories/${P}/move$`),
        (m, req) => this.moveRepository(m[1], req.body),
      ],
      [
        'GET',
        new RegExp(`^/delivery-projects/${P}$`),
        (m) => ({ body: this.deliveryProject(this.requireFolder(m[1])) }),
      ],
      [
        'POST',
        new RegExp(`^/delivery-projects/${P}/archive$`),
        (m) => ({ body: this.archiveFolder(m[1]) }),
      ],
      [
        'PATCH',
        new RegExp(`^/qa-checklists/${P}/projects$`),
        (m, req) => ({ body: this.patchChecklistShares(m[1], req.body) }),
      ],
      // The Create Project wizard (/workflows): read-only fixtures
      ['GET', /^\/catalog\/categories$/, () => ({ body: { categories: [] } })],
      ['GET', /^\/catalog\/templates$/, () => ({ body: { templates: [] } })],
      ['GET', /^\/workflows\/history$/, () => ({ body: { items: [] } })],
      ['GET', /^\/usage\/me$/, () => ({ body: { enabled: false, items: [] } })],
      [
        'GET',
        /^\/github\/app\/install-url$/,
        () => ({
          body: {
            installUrl: 'https://github.com/apps/alphaci/installations/new',
            appSlug: 'alphaci',
          },
        }),
      ],
      [
        'GET',
        /^\/github\/installations\/accounts$/,
        () => ({ body: { accounts: [] } }),
      ],
      [
        'GET',
        /^\/github\/installations\/repos$/,
        () => ({ body: { repos: [] } }),
      ],
      ['GET', /^\/provider-connections$/, () => ({ body: [] })],
      [
        'GET',
        new RegExp(`^/projects/${P}/qa-my-items$`),
        () => ({ body: this.myItems() }),
      ],
      // Promotion
      [
        'GET',
        new RegExp(`^/projects/${P}/qa/promotion$`),
        (m) => ({ body: this.promotion(m[1]) }),
      ],
      [
        'POST',
        new RegExp(`^/projects/${P}/qa/promotion/merge$`),
        (m) => ({ body: this.mergePromotion(m[1]) }),
      ],
    ];
  }

  /* ── Session, capabilities, workspace ── */

  private authMe(): AuthMeResponse {
    const person = PEOPLE[this.role];
    return {
      authenticated: true,
      user: {
        id: person.id,
        login: person.login,
        name: person.name,
        email: person.email,
        onboardingCompleted: true,
      },
      subscription: {
        plan: 'pro',
        status: 'active',
        provider: 'manual',
        updatedAt: ago(90 * 24 * 60 * MINUTE),
      },
      platformRole: null,
      appRole: this.role,
      appRoleSource: 'github_team',
    };
  }

  /** The backend's CapabilitiesController shape for an enterprise deployment. */
  private capabilities(): CapabilitiesResponse {
    const capabilities: CapabilitiesResponse = {
      edition: 'enterprise',
      capabilityKeys: [],
      clientComposition: {
        enabled: false,
        clientId: null,
        displayName: null,
        edition: null,
        disabledCapabilities: [],
      },
      envProvisioning: {
        enabled: true,
        providers: ['render', 'vercel'],
        environments: ['test', 'uat', 'production'],
        modes: ['flowci_managed'],
      },
      projectSyncSnapshots: {
        enabled: true,
        liveGithubEnabled: false,
        liveProvidersEnabled: false,
        mode: 'local_snapshot',
      },
      workflowSettingsPreview: { enabled: true },
      workflowUpdatePr: { enabled: true },
      qaChecklists: { enabled: true },
      projectTargetManagement: { enabled: true },
      ciRunTracking: {
        enabled: true,
        liveGithubEnabled: false,
        mode: 'local_mock',
      },
      deploymentHistory: {
        enabled: true,
        liveProvidersEnabled: true,
        mode: 'local_mock',
      },
      previewDeployments: { enabled: true, providers: ['vercel'] },
      driftDetection: {
        enabled: true,
        liveProviderChecksEnabled: false,
        mode: 'local_snapshot',
      },
      driftRepair: {
        enabled: true,
        liveRepairEnabled: false,
        mode: 'local_safe',
      },
      usageQuotas: { enabled: true },
      workspaces: { enabled: true },
      auditEvents: { enabled: true },
      notifications: { enabled: true },
      hierarchy: { enabled: true, githubSyncMode: 'stub' },
    };
    if (this.qaCapability === 'absent') {
      // An older or differently composed backend that never sends the field.
      // The app must read that as "off" — not as "on", and not crash.
      delete capabilities.qaChecklists;
    }
    return capabilities;
  }

  private workspacesMe(): WorkspacesMeResponse {
    return {
      enabled: true,
      items: [
        {
          id: WORKSPACE.id,
          name: WORKSPACE.name,
          kind: 'team',
          role:
            this.role === 'lead' || this.role === 'admin' ? 'admin' : 'member',
        },
      ],
    };
  }

  private group(): GroupSummary {
    return {
      id: WORKSPACE.id,
      name: WORKSPACE.name,
      description: 'Storefront checkout and payments.',
      businessUnit: null,
      status: 'active',
      role: this.role === 'lead' || this.role === 'admin' ? 'admin' : 'member',
      memberCount: 3,
      systemCount: 0,
      createdAt: ago(120 * 24 * 60 * MINUTE),
      archivedAt: null,
      archivedBy: null,
    };
  }

  /** The team's roster: its Lead, a QA Team member and a Developer. */
  private groupMembers(groupId: string): GroupMember[] {
    if (groupId !== WORKSPACE.id) throw nestError(404, 'Group not found');
    const roster: Array<[AppRole, GroupMember['role']]> = [
      ['lead', 'admin'],
      ['qa', 'member'],
      ['member', 'member'],
    ];
    return roster.map(([appRole, role]) => {
      const person = PEOPLE[appRole];
      return {
        id: `gm-${person.id}`,
        groupId,
        userId: person.id,
        role,
        appRole,
        memberStatus: 'active',
        login: person.login,
        name: person.name,
        email: person.email,
        avatarUrl: null,
        invitedBy: null,
        invitedAt: null,
        removedAt: null,
        removedBy: null,
        removalReason: null,
        createdAt: ago(100 * 24 * 60 * MINUTE),
      };
    });
  }

  /** One single-app Next.js type, enough to walk the wizard to its Repository step. */
  private projectOptions(): ProjectOptionsResponse {
    const options = {
      lint: true,
      unit: true,
      build: true,
      coverage: true,
      security: true,
      docker: false,
    };
    return {
      repoShapes: [
        {
          id: 'single-app',
          label: 'Single App',
          enabled: true,
          description: 'One repository contains one app or service.',
        },
      ],
      projectTypes: [
        {
          id: 'nextjs-app',
          label: 'Next.js App',
          kind: 'frontend',
          runtime: 'node',
          language: 'typescript',
          framework: 'nextjs',
          starterPath: 'starter-templates/nextjs-app',
          repoShapes: ['single-app'],
          defaultRecipe: 'frontend-standard-ci',
          allowedRecipes: ['frontend-standard-ci'],
          defaultOptions: options,
        },
      ],
      recipes: [
        {
          id: 'frontend-standard-ci',
          label: 'Frontend Standard CI',
          description: 'Validate and build frontend apps.',
          supportedProjectTypes: ['nextjs-app'],
          templateByProjectType: { 'nextjs-app': 'fe-nextjs' },
          mandatoryJobs: ['validate-access'],
          supportedOptions: options,
          optionJobs: {
            lint: 'lint',
            unit: 'unit-tests',
            build: 'build',
            coverage: 'unit-tests',
            security: 'security',
          },
        },
      ],
      nodeVersions: [{ value: '24', label: 'Node.js 24' }],
      enforcedOrg: 'tone',
    } as unknown as ProjectOptionsResponse;
  }

  private projectsFor(workspaceId: string | null): ProvisionedProject[] {
    return PROJECTS.filter(
      (project) => !workspaceId || project.workspaceId === workspaceId,
    );
  }

  private requireProject(projectId: string): TeamProject {
    const project = PROJECTS.find((entry) => entry.id === projectId);
    if (!project) throw nestError(404, 'Project not found');
    return project;
  }

  private overview(projectId: string): ProjectOverviewResponse {
    const project = this.requireProject(projectId);
    return {
      project: {
        ...project,
        createdAt: ago(60 * 24 * 60 * MINUTE),
        updatedAt: ago(24 * 60 * MINUTE),
      },
      workflow: {
        path: project.workflowPath,
        files: project.workflowFiles,
        stageCount: project.workflowFiles.length,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: 'active',
        tokenPresent: true,
        tokenPrefix: 'aci_live',
        createdAt: ago(60 * 24 * 60 * MINUTE),
        updatedAt: ago(60 * 24 * 60 * MINUTE),
        revokedAt: null,
      },
      health: { summary: 'ok', checks: [] },
      syncSnapshot: { enabled: false, mode: 'local_snapshot', latest: null },
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: false,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: false,
      },
      hierarchyRepositoryId: null,
    };
  }

  /**
   * GET /projects/:id/audit — newest first, `?limit` 1-100 (400 otherwise),
   * `?before=<next>` an exclusive createdAt cursor. Two pages for project-1:
   * the newest event is a Project-scoped requirement event by the lead, the
   * oldest a System event.
   */
  private audit(projectId: string, query: URLSearchParams): ApiReply {
    this.requireProject(projectId);
    const limitText = query.get('limit');
    const limit = limitText === null ? 50 : Number(limitText);
    if (!Number.isInteger(limit) || limit < 1)
      throw nestError(400, 'limit must be a positive integer');
    const before = query.get('before');
    const all: ProjectAuditEventsResponse['items'] = [
      {
        id: 'audit-3',
        eventCode: 'qa.requirement.created',
        message: 'Added Feature Checkout.',
        actorUserId: PEOPLE.lead.id,
        actorLogin: PEOPLE.lead.login,
        metadata: {},
        createdAt: '2026-10-01T09:00:00.000000+00:00',
        scope: 'project',
      },
      {
        id: 'audit-2',
        eventCode: 'pull_request_merged',
        message: 'Merged pull request #12 into dev.',
        actorUserId: PEOPLE.member.id,
        actorLogin: PEOPLE.member.login,
        metadata: {},
        createdAt: '2026-09-30T09:00:00.123456+00:00',
        scope: 'repository',
      },
      {
        id: 'audit-1',
        eventCode: 'project_created',
        message: 'Repository created',
        actorUserId: null,
        actorLogin: null,
        metadata: { backfilledFromOutbox: true },
        createdAt: '2026-09-29T09:00:00.000000+00:00',
        scope: 'repository',
      },
    ];
    const older = before ? all.filter((item) => item.createdAt < before) : all;
    const page = older.slice(0, Math.min(limit, 2));
    const next =
      older.length > page.length ? page[page.length - 1].createdAt : null;
    // GitHub activity: 'failed' until POST /audit/sync has run once, then 'ok'.
    const githubSync = this.auditSyncedAt
      ? { status: 'ok' as const, syncedAt: this.auditSyncedAt }
      : { status: 'failed' as const, syncedAt: null };
    return {
      body: {
        enabled: true,
        items: page,
        next,
        githubSync,
      } satisfies ProjectAuditEventsResponse,
    };
  }

  /** Set by POST /projects/:id/audit/sync; flips the trail's githubSync to 'ok'. */
  private auditSyncedAt: string | null = null;

  /** POST /projects/:id/audit/sync — forces a GitHub activity read. */
  private syncAudit(projectId: string): ApiReply {
    this.requireProject(projectId);
    this.auditSyncedAt = new Date().toISOString();
    return { body: { synced: 0 } };
  }

  /**
   * GET /projects/:id/commits — `?branch` (default dev), `?limit` 1-100,
   * `?before=<next>` (here, a sha). dev has a PR-merged commit, a person's direct
   * push and two ALPHACI setup commits (made by the GitHub App bot).
   */
  private commits(projectId: string, query: URLSearchParams): ApiReply {
    this.requireProject(projectId);
    const limitText = query.get('limit');
    const limit = limitText === null ? 30 : Number(limitText);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw nestError(400, 'limit must be between 1 and 100');
    const branch = query.get('branch') ?? 'dev';
    const all: ProjectCommitsResponse['items'] = [
      {
        sha: 'c0ffee1000000000000000000000000000000001',
        shortSha: 'c0ffee1',
        message: 'Hotfix copy on the banner',
        authorLogin: PEOPLE.member.login,
        authorName: 'Member',
        authoredAt: '2026-10-01T09:00:00Z',
        url: 'https://github.com/org/repo/commit/c0ffee1',
        pullRequestNumber: null,
      },
      {
        sha: 'c0ffee2000000000000000000000000000000002',
        shortSha: 'c0ffee2',
        message: 'Add checkout (#12)\n\nBody.',
        authorLogin: PEOPLE.member.login,
        authorName: 'Member',
        authoredAt: '2026-09-30T09:00:00Z',
        url: 'https://github.com/org/repo/commit/c0ffee2',
        pullRequestNumber: 12,
      },
      {
        sha: 'c0ffee3000000000000000000000000000000003',
        shortSha: 'c0ffee3',
        message: 'chore: add the ALPHACI workflow',
        authorLogin: 'alphaci-enterprise[bot]',
        authorName: 'alphaci-enterprise[bot]',
        authoredAt: '2026-09-29T09:00:00Z',
        url: 'https://github.com/org/repo/commit/c0ffee3',
        pullRequestNumber: null,
      },
      {
        sha: 'c0ffee4000000000000000000000000000000004',
        shortSha: 'c0ffee4',
        message: 'chore: install ALPHACI configuration',
        authorLogin: 'alphaci-enterprise[bot]',
        authorName: 'alphaci-enterprise[bot]',
        authoredAt: '2026-09-29T08:55:00Z',
        url: 'https://github.com/org/repo/commit/c0ffee4',
        pullRequestNumber: null,
      },
    ];
    const before = query.get('before');
    const start = before ? all.findIndex((item) => item.sha === before) + 1 : 0;
    const items = all.slice(start, start + limit);
    const next =
      start + items.length < all.length ? items[items.length - 1].sha : null;
    return {
      body: {
        branch,
        branches: ['main', 'uat', 'dev', 'feature/banner'],
        items,
        next,
      } satisfies ProjectCommitsResponse,
    };
  }

  private previews(projectId: string): ProjectPreviewsResponse {
    const project = this.requireProject(projectId);
    if (project.id !== PROJECT_ID)
      return {
        enabled: true,
        liveProvidersEnabled: true,
        providerError: null,
        branches: [],
      };
    return {
      enabled: true,
      liveProvidersEnabled: true,
      providerError: null,
      branches: [
        {
          branch: 'main',
          isProduction: true,
          deploymentId: 'dpl-main',
          targetId: 'target-web',
          targetName: 'storefront-web',
          provider: 'vercel',
          status: 'ready',
          commitSha: MAIN_SHA,
          commitMessage: 'release: storefront 2.4',
          pullRequestNumber: null,
          createdBy: PEOPLE.lead.login,
          previewUrl: MAIN_PREVIEW_ORIGIN,
          deploymentUrl: null,
          inspectorUrl: null,
          createdAt: ago(6 * 60 * MINUTE),
          readyAt: ago(6 * 60 * MINUTE - MINUTE),
          embeddable: true,
          embedBlockedReason: null,
          slot: 'frontend',
          surface: 'page',
          providerLabel: 'Vercel',
          logsAvailable: false,
          logWindow: null,
          trigger: null,
          startedAt: null,
          recentDeploys: [],
        },
        {
          branch: QA_BRANCH,
          isProduction: false,
          deploymentId: 'dpl-uat',
          targetId: 'target-web',
          targetName: 'storefront-web',
          provider: 'vercel',
          status: 'ready',
          commitSha: UAT_SHA,
          commitMessage: 'fix(cart): apply coupons per line',
          pullRequestNumber: null,
          createdBy: PEOPLE.member.login,
          previewUrl: PREVIEW_ORIGIN,
          deploymentUrl: null,
          inspectorUrl: null,
          createdAt: ago(40 * MINUTE),
          readyAt: ago(38 * MINUTE),
          embeddable: true,
          embedBlockedReason: null,
          slot: 'frontend',
          surface: 'page',
          providerLabel: 'Vercel',
          logsAvailable: false,
          logWindow: null,
          trigger: null,
          startedAt: null,
          recentDeploys: [],
        },
      ],
    };
  }

  /* ── Project folders ── */

  private isLead(): boolean {
    return this.role === 'lead' || this.role === 'admin';
  }

  /**
   * GET /groups/:id/activity — GroupActivityService.listActivity calls
   * assertGroupManagerOrPlatformAdmin(['admin', 'delegated_lead']): a platform
   * admin, or the team's Lead (group role admin here). Everyone else is a 403.
   */
  private groupActivity(groupId: string): ApiReply {
    if (groupId !== WORKSPACE.id) throw nestError(404, 'Group not found');
    if (!this.isLead()) {
      return {
        status: 403,
        body: {
          statusCode: 403,
          message: 'Insufficient group role',
          error: 'Forbidden',
        },
        expected: this.activityForbiddenArmed,
      };
    }
    return { body: { items: [], nextCursor: null } };
  }

  private requireFolder(folderId: string): FolderRow {
    const folder = this.folders.find((entry) => entry.id === folderId);
    if (!folder) throw nestError(404, 'Delivery project not found');
    return folder;
  }

  private deliveryProject(folder: FolderRow): DeliveryProject {
    return {
      id: folder.id,
      systemId: SYSTEM_ID,
      groupId: WORKSPACE.id,
      name: folder.name,
      description: null,
      managerId: null,
      status: folder.archived ? 'archived' : 'active',
      archivedAt: folder.archived ? folder.createdAt : null,
      repositoryCount: folder.repositories.filter((repo) => !repo.archived)
        .length,
      createdAt: folder.createdAt,
      updatedAt: folder.createdAt,
    };
  }

  private projectFolders(groupId: string): ProjectFoldersResponseWire {
    // A non-member (or a missing team) gets 404, exactly like the backend.
    if (groupId !== WORKSPACE.id) throw nestError(404, 'Group not found');
    const live = this.folders
      .filter((folder) => !folder.archived)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const filed = new Set(
      live.flatMap((folder) =>
        folder.repositories.map((repo) => repo.projectId),
      ),
    );
    return {
      groupId,
      canManage: this.isLead(),
      // BE #145: Product owners (lead) create Projects; Developers (member) add repositories; admin both.
      canCreateProject: this.role === 'lead' || this.role === 'admin',
      canCreateRepository: this.role === 'member' || this.role === 'admin',
      folders: live.map((folder) => ({
        deliveryProjectId: folder.id,
        systemId: SYSTEM_ID,
        name: folder.name,
        createdAt: folder.createdAt,
        // Newer backends only: a backend from before Project requirements sends no count.
        ...(this.projectQa === 'enabled'
          ? { featureCount: this.featureCount(folder.id) }
          : {}),
        repositories: folder.repositories
          .filter((repo) => !repo.archived)
          .map((repo) => ({
            repositoryId: repo.id,
            name: repo.name,
            repoFullName: repo.repoFullName,
            status: 'active',
            project: repo.projectId
              ? {
                  id: repo.projectId,
                  role: repo.role,
                  status: 'provisioned',
                  repoShape: 'multi-repo',
                }
              : null,
          })),
      })),
      unfiled: PROJECTS.filter((project) => !filed.has(project.id)).map(
        (project) => ({
          id: project.id,
          name: project.serviceName,
          repoFullName: project.repoFullName,
          role: 'app' as const,
          status: 'provisioned',
          repoShape: 'standalone',
        }),
      ),
    };
  }

  /** GET /projects/:id/folder — the Project a repository is in, frontend first. */
  private projectFolder(projectId: string): ProjectFolderWire {
    const project = PROJECTS.find((entry) => entry.id === projectId);
    if (!project) throw nestError(404, 'Project not found');
    const folder = this.folders.find(
      (entry) =>
        !entry.archived &&
        entry.repositories.some(
          (repo) => !repo.archived && repo.projectId === projectId,
        ),
    );
    if (!folder) {
      // Unfiled: a Project of one, which the page shows exactly as before.
      return {
        deliveryProjectId: null,
        groupId: WORKSPACE.id,
        name: project.serviceName,
        repositories: [
          {
            projectId,
            name: project.serviceName,
            repoFullName: project.repoFullName,
            role: 'app',
            status: 'provisioned',
          },
        ],
      };
    }
    const order: RepoRole[] = ['frontend', 'backend', 'service', 'app'];
    return {
      deliveryProjectId: folder.id,
      groupId: WORKSPACE.id,
      name: folder.name,
      repositories: folder.repositories
        .filter((repo) => !repo.archived)
        .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
        .map((repo) => ({
          projectId: repo.projectId,
          name: repo.name,
          repoFullName: repo.repoFullName,
          role: repo.role,
          status: repo.projectId ? 'provisioned' : null,
        })),
    };
  }

  private createFolder(
    groupId: string,
    body: Record<string, unknown>,
  ): DeliveryProject {
    if (groupId !== WORKSPACE.id) throw nestError(404, 'Group not found');
    if (!this.isLead())
      throw nestError(403, 'Only a team lead can create projects');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 200)
      throw nestError(400, 'name must be between 1 and 200 characters');
    const folder: FolderRow = {
      id: this.nextId('folder'),
      name,
      createdAt: new Date().toISOString(),
      archived: false,
      repositories: [],
    };
    this.folders.push(folder);
    return this.deliveryProject(folder);
  }

  private moveRepository(
    repositoryId: string,
    body: Record<string, unknown>,
  ): ApiReply {
    if (!this.isLead())
      throw nestError(403, 'Only a team lead can move repositories');
    const source = this.folders.find((folder) =>
      folder.repositories.some((repo) => repo.id === repositoryId),
    );
    const repo = source?.repositories.find(
      (entry) => entry.id === repositoryId,
    );
    if (!source || !repo) throw nestError(404, 'Repository not found');
    const target = this.requireFolder(String(body.deliveryProjectId ?? ''));
    if (repo.archived || target.archived)
      throw nestError(
        400,
        'Archived repositories and projects cannot be moved',
      );
    if (this.moveConflictArmed) {
      this.moveConflictArmed = false;
      // Someone else got there first: the repository now sits in the target.
      source.repositories.splice(source.repositories.indexOf(repo), 1);
      target.repositories.push(repo);
      return {
        status: 409,
        body: {
          statusCode: 409,
          message: 'Repository was moved concurrently',
          error: 'Conflict',
        },
        expected: true,
      };
    }
    if (source === target) {
      return {
        body: {
          repository: { id: repo.id },
          moved: false,
          sourceDeliveryProjectId: source.id,
          sourceDeliveryProjectEmpty: false,
        },
      };
    }
    source.repositories.splice(source.repositories.indexOf(repo), 1);
    target.repositories.push(repo);
    const reply: MoveRepositoryResponseWire = {
      repository: { id: repo.id, deliveryProjectId: target.id },
      moved: true,
      sourceDeliveryProjectId: source.id,
      sourceDeliveryProjectEmpty:
        source.repositories.filter((entry) => !entry.archived).length === 0,
    };
    return { body: reply };
  }

  private archiveFolder(folderId: string): DeliveryProject {
    if (!this.isLead())
      throw nestError(403, 'Only a team lead can archive projects');
    const folder = this.requireFolder(folderId);
    folder.archived = true;
    return this.deliveryProject(folder);
  }

  private patchChecklistShares(
    checklistId: string,
    body: Record<string, unknown>,
  ): QaChecklist {
    const checklist = this.requireChecklist(checklistId);
    this.assertManage();
    if (checklist.archivedAt) throw nestError(409, 'Checklist is archived');
    const patch = body as ChecklistProjectsPatch;
    const add = [...new Set(patch.add ?? [])];
    const remove = new Set(patch.remove ?? []);
    const rejected = [...add, ...remove].filter(
      (id) =>
        !PROJECTS.some(
          (p) => p.id === id && p.workspaceId === checklist.workspaceId,
        ),
    );
    if (rejected.length > 0) {
      throw nestError(
        400,
        `These project ids are not in this checklist's workspace: ${rejected.join(', ')}`,
      );
    }
    // Only the named ids change; every other share stays exactly as it was.
    const next = checklist.sharedProjectIds.filter((id) => !remove.has(id));
    for (const id of add) if (!next.includes(id)) next.push(id);
    checklist.sharedProjectIds = next;
    return checklist;
  }

  /* ── Checklists (qa-checklists.service.ts) ── */

  private requireChecklist(checklistId: string): QaChecklist {
    const checklist = this.checklists.find((entry) => entry.id === checklistId);
    if (!checklist) throw nestError(404, 'Checklist not found');
    return checklist;
  }

  private assertManage() {
    if (!canManageChecklists(this.role)) {
      throw nestError(
        403,
        'Only a workspace lead or admin can manage QA checklists',
      );
    }
  }

  private listWorkspaceChecklists(
    workspaceId: string,
    query: URLSearchParams,
  ): QaChecklistListResponse {
    if (workspaceId !== WORKSPACE.id)
      throw nestError(404, 'Checklist not found');
    const includeArchived = query.get('includeArchived') === 'true';
    return {
      items: this.checklists.filter(
        (entry) => includeArchived || entry.archivedAt === null,
      ),
      canManage: canManageChecklists(this.role),
    };
  }

  private createChecklist(
    workspaceId: string,
    body: Record<string, unknown>,
  ): QaChecklist {
    if (workspaceId !== WORKSPACE.id)
      throw nestError(404, 'Checklist not found');
    this.assertManage();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw nestError(400, 'name must not be blank');
    if (
      this.checklists.some(
        (entry) => entry.archivedAt === null && entry.name === name,
      )
    ) {
      throw nestError(
        409,
        `A checklist named "${name}" already exists in this workspace.`,
      );
    }
    const now = new Date().toISOString();
    const items = (body.items as QaChecklistItemInput[] | undefined) ?? [];
    const checklist: QaChecklist = {
      id: this.nextId('checklist'),
      workspaceId,
      name,
      description: (body.description as string | null | undefined) ?? null,
      version: 1,
      archivedAt: null,
      createdBy: this.actor.id,
      createdAt: now,
      updatedAt: now,
      items: this.toChecklistItems(items),
      sharedProjectIds: [],
    };
    this.checklists.push(checklist);
    return checklist;
  }

  private shareChecklist(
    checklistId: string,
    body: Record<string, unknown>,
  ): QaChecklist {
    const checklist = this.requireChecklist(checklistId);
    this.assertManage();
    if (checklist.archivedAt) throw nestError(409, 'Checklist is archived');
    const requested = [
      ...new Set((body.projectIds as string[] | undefined) ?? []),
    ];
    const rejected = requested.filter(
      (id) =>
        !PROJECTS.some(
          (p) => p.id === id && p.workspaceId === checklist.workspaceId,
        ),
    );
    if (rejected.length > 0) {
      throw nestError(
        400,
        `These project ids are not in this checklist's workspace: ${rejected.join(', ')}`,
      );
    }
    // Sharing does not bump the checklist version: only content edits do.
    checklist.sharedProjectIds = requested;
    return checklist;
  }

  private listProjectChecklists(projectId: string): QaChecklistListResponse {
    const project = this.requireProject(projectId);
    return {
      items: this.checklists
        .filter(
          (entry) =>
            entry.archivedAt === null &&
            entry.sharedProjectIds.includes(project.id),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      canManage: Boolean(project.workspaceId) && canManageChecklists(this.role),
    };
  }

  /* ── Runs (qa-runs.service.ts) ── */

  private createRunRow(
    checklist: QaChecklist,
    branch: string,
    commitSha: string,
    createdBy: QaActor,
  ): RunRow {
    const id = this.nextId('run');
    const now = new Date().toISOString();
    return {
      id,
      checklistId: checklist.id,
      checklistName: checklist.name,
      checklistVersion: checklist.version,
      branch,
      commitSha,
      status: 'open',
      createdBy,
      createdAt: now,
      updatedAt: now,
      signoff: null,
      frozen: null,
      items: checklist.items.map((item) => ({
        ...item,
        id: this.nextId('run-item'),
        status: 'pending',
        notes: null,
        defectSeverity: null,
        reproductionSteps: null,
        fixRequest: null,
        verifiedBy: null,
        verifiedAt: null,
        rowVersion: 1,
        updatedAt: Date.now(),
      })),
    };
  }

  private requireRun(runId: string): RunRow {
    const run = this.runs.find((entry) => entry.id === runId);
    if (!run) throw nestError(404, 'QA run not found');
    return run;
  }

  private requireOpen(run: RunRow) {
    if (run.status === 'signed_off')
      throw nestError(
        409,
        'This run is signed off. Reopen it to make changes.',
      );
  }

  /** The backend accepts QA runs on the QA branch only: any other branch is a 400 the UI must never cause. */
  private requireHostedBranch(branch: string) {
    if (branch !== QA_BRANCH) {
      throw nestError(
        400,
        `QA verification runs are only supported on ${QA_BRANCH}.`,
      );
    }
  }

  /** Commit resolution: the storefront's uat is deployed at UAT_SHA. */
  private resolveCommit(
    branch: string,
  ): { commitSha: string; commitSource: 'deployment' } | null {
    return branch === QA_BRANCH
      ? { commitSha: UAT_SHA, commitSource: 'deployment' }
      : null;
  }

  private currentRun(query: URLSearchParams): QaCurrentRunResponse {
    const branch = (query.get('branch') ?? '').trim();
    this.requireHostedBranch(branch);
    const resolved = this.resolveCommit(branch);
    if (!resolved) return { commitSha: null, commitSource: null, run: null };
    const checklistId = query.get('checklistId')?.trim();
    const run = checklistId
      ? this.runs.find(
          (entry) =>
            entry.checklistId === checklistId &&
            entry.branch === branch &&
            entry.commitSha === resolved.commitSha,
        )
      : undefined;
    return { ...resolved, run: run ? this.assembleRun(run) : null };
  }

  private createRun(body: Record<string, unknown>): ApiReply {
    if (!canCreateRun(this.role))
      throw nestError(
        403,
        'Only QA, a lead, or an admin may start a verification run.',
      );
    const branch = String(body.branch ?? '').trim();
    this.requireHostedBranch(branch);
    const checklist = this.checklists.find(
      (entry) =>
        entry.id === body.checklistId &&
        entry.archivedAt === null &&
        entry.sharedProjectIds.includes(PROJECT_ID),
    );
    if (!checklist)
      throw nestError(
        409,
        'This checklist is not shared to this project, or is archived.',
      );
    const resolved = this.resolveCommit(branch);
    if (!resolved)
      throw nestError(
        409,
        `No deployed or pushed commit was found for ${branch}.`,
      );
    const existing = this.runs.find(
      (entry) =>
        entry.checklistId === checklist.id &&
        entry.branch === branch &&
        entry.commitSha === resolved.commitSha,
    );
    if (existing) return { status: 200, body: this.assembleRun(existing) };
    const run = this.createRunRow(
      checklist,
      branch,
      resolved.commitSha,
      this.actor,
    );
    this.runs.push(run);
    return { status: 201, body: this.assembleRun(run) };
  }

  private updateItem(
    runId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): QaRun {
    const run = this.requireRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    this.requireOpen(run);
    if (!personaAllowsRole(item.targetPersona, this.role))
      throw nestError(403, 'You are not allowed to update this item.');
    const status = body.status as QaRunItemStatus | undefined;
    if (status === 'returned_to_dev' && !canSetReturnedToDev(this.role)) {
      throw nestError(
        403,
        'Only QA, a lead, or an admin may return an item to development.',
      );
    }
    const severity =
      body.defectSeverity !== undefined
        ? (body.defectSeverity as QaDefectSeverity | null)
        : item.defectSeverity;
    if ((status === 'failed' || status === 'returned_to_dev') && !severity) {
      throw nestError(
        400,
        'A defect severity is required to mark this item failed or returned to dev.',
      );
    }
    if (body.expectedRowVersion !== item.rowVersion) {
      throw new HttpError(409, {
        code: 'QA_ITEM_STALE',
        message: `This item has changed (expected row version ${String(body.expectedRowVersion)}); reload and try again.`,
      });
    }
    if (status !== undefined) {
      item.status = status;
      const cleared = status === 'pending' || status === 'in_progress';
      item.verifiedBy = cleared ? null : this.actor;
      item.verifiedAt = cleared ? null : new Date().toISOString();
      // Returning an item opens a new fix round; an earlier "fixed" no longer applies.
      if (status === 'returned_to_dev') item.fixRequest = null;
    }
    if (body.notes !== undefined) item.notes = body.notes as string | null;
    if (body.defectSeverity !== undefined)
      item.defectSeverity = body.defectSeverity as QaDefectSeverity | null;
    if (body.reproductionSteps !== undefined)
      item.reproductionSteps = body.reproductionSteps as string | null;
    item.rowVersion += 1;
    item.updatedAt = Date.now();
    run.updatedAt = new Date().toISOString();
    return this.assembleRun(run);
  }

  private requestRetest(
    runId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): QaRun {
    const run = this.requireRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    this.requireOpen(run);
    if (!canRequestRetest(this.role))
      throw nestError(
        403,
        'Only a developer, lead, or admin may request a retest.',
      );
    if (item.status !== 'returned_to_dev')
      throw nestError(409, 'This item is not currently returned to dev.');
    item.status = 'pending';
    item.fixRequest = {
      requestedAt: new Date().toISOString(),
      requestedBy: this.actor,
      note: (body.note as string | undefined) ?? null,
    };
    item.verifiedBy = null;
    item.verifiedAt = null;
    item.rowVersion += 1;
    item.updatedAt = Date.now();
    return this.assembleRun(run);
  }

  private signoff(runId: string, body: Record<string, unknown>): QaRun {
    const run = this.requireRun(runId);
    this.requireOpen(run);
    if (!canSignOff(this.role))
      throw nestError(403, 'Only QA, a lead, or an admin may sign off a run.');
    const verdict = body.verdict as QaVerdict;
    if (verdict === 'APPROVED') {
      const notPassed = run.items.filter(
        (item) => item.status !== 'passed',
      ).length;
      if (notPassed > 0) {
        throw nestError(
          409,
          `${notPassed} item(s) are not yet passed; an APPROVED sign-off requires every item to be passed.`,
        );
      }
    }
    if (verdict === 'CONDITIONAL') {
      if (
        run.items.some(
          (item) => item.status === 'pending' || item.status === 'in_progress',
        )
      ) {
        throw nestError(
          409,
          'A CONDITIONAL sign-off requires no item to remain pending or in progress.',
        );
      }
      if (typeof body.conditions !== 'string' || !body.conditions.trim()) {
        throw nestError(
          400,
          'conditions is required for a CONDITIONAL verdict.',
        );
      }
    }
    const now = new Date().toISOString();
    run.signoff = {
      id: this.nextId('signoff'),
      verdict,
      summary: (body.summary as string | undefined) ?? null,
      conditions: (body.conditions as string | undefined) ?? null,
      signedBy: this.actor,
      signedAt: now,
    };
    run.status = 'signed_off';
    run.updatedAt = now;
    run.frozen = this.assembleRun(run);
    return this.assembleRun(run);
  }

  private dispatchAutomation(runId: string): QaAutomationDispatchWire {
    const run = this.requireRun(runId);
    if (!canDispatchAutomation(this.role))
      throw nestError(
        403,
        'Only QA, a lead, or an admin may run Playwright for this run.',
      );
    this.requireOpen(run);
    return {
      workflowFile: '40-alphaci-verify.yml',
      ref: run.branch,
      headSha: run.commitSha,
      targetsRunCommit: true,
    };
  }

  private returnedItems(): QaReturnedItem[] {
    return this.runs
      .filter((run) => run.status === 'open')
      .flatMap((run) =>
        run.items
          .filter((item) => item.status === 'returned_to_dev')
          .map((item) => ({ run, item })),
      )
      .sort((a, b) => b.item.updatedAt - a.item.updatedAt)
      .map(({ run, item }) => ({
        runId: run.id,
        branch: run.branch,
        commitSha: run.commitSha,
        checklistName: run.checklistName,
        item: this.toRunItem(run, item),
      }));
  }

  /** qa-my-items: what QA returned, plus the developer items of the open uat runs on uat's current head. */
  private myItems(): QaMyItemsResponse {
    const developerItems = this.runs
      .filter(
        (run) =>
          run.status === 'open' &&
          run.branch === QA_BRANCH &&
          run.commitSha === UAT_SHA,
      )
      .flatMap((run) =>
        run.items
          .filter((item) => item.targetPersona === 'developer')
          .map((item) => ({ run, item })),
      )
      .sort((a, b) => a.item.position - b.item.position)
      .map(({ run, item }) => ({
        runId: run.id,
        branch: run.branch,
        commitSha: run.commitSha,
        checklistName: run.checklistName,
        item: this.toRunItem(run, item),
      }));
    return { returned: this.returnedItems(), developerItems };
  }

  /* ── Promotion (qa-promotion rules: every non-archived shared checklist APPROVED on uat's current head) ── */

  private promotionChecklists(projectId: string): QaPromotionChecklistWire[] {
    return this.checklists
      .filter(
        (entry) =>
          entry.archivedAt === null &&
          entry.sharedProjectIds.includes(projectId),
      )
      .map((checklist) => {
        const run = this.runs.find(
          (entry) =>
            entry.checklistId === checklist.id &&
            entry.branch === QA_BRANCH &&
            entry.commitSha === UAT_SHA,
        );
        const verdict =
          run?.status === 'signed_off' ? (run.signoff?.verdict ?? null) : null;
        return {
          id: checklist.id,
          name: checklist.name,
          runId: run?.id ?? null,
          verdict,
          runStatus: run?.status ?? null,
          approvedForHead: verdict === 'APPROVED',
        };
      });
  }

  private promotionReasons(checklists: QaPromotionChecklistWire[]): string[] {
    if (checklists.length === 0)
      return ['No QA checklist is shared with this project.'];
    const head = `${QA_BRANCH} @ ${UAT_SHA.slice(0, 7)}`;
    return checklists
      .filter((entry) => entry.approvedForHead !== true)
      .map((entry) => {
        if (!entry.runId)
          return `${String(entry.name)} has no QA run on ${head}.`;
        if (entry.runStatus !== 'signed_off')
          return `${String(entry.name)} is not signed off on ${head}.`;
        return `${String(entry.name)} is signed off ${String(entry.verdict)}, not APPROVED, on ${head}.`;
      });
  }

  /** The repositories of a Project that reached main, by repository id. */
  readonly deliveredRepositories = new Set<string>();

  private folderOfRepository(projectId: string): FolderRow | null {
    return (
      this.folders.find(
        (folder) =>
          !folder.archived &&
          folder.repositories.some(
            (repo) => !repo.archived && repo.projectId === projectId,
          ),
      ) ?? null
    );
  }

  private latestSignedOffRun(folderId: string): ProjectRunRow | null {
    return (
      this.projectRuns
        .filter(
          (run) =>
            run.deliveryProjectId === folderId && run.status === 'signed_off',
        )
        .at(-1) ?? null
    );
  }

  private iterationDelivered(folder: FolderRow): boolean {
    const heads = this.folderHeads(folder);
    return (
      heads.length > 0 &&
      heads.every((head) => this.deliveredRepositories.has(head.projectId))
    );
  }

  /** GET /delivery-projects/:id/iterations/current, as qa-project-delivery.service.ts current. */
  private currentIteration(folderId: string) {
    const folder = this.requireFolder(folderId);
    const delivered = this.iterationDelivered(folder);
    const run = this.latestSignedOffRun(folder.id);
    const approved = run?.signoff?.verdict === 'APPROVED';
    const heads = this.folderHeads(folder);
    return {
      iteration: {
        id: `iteration-${folder.id}-1`,
        number: 1,
        status: delivered ? 'delivered' : 'active',
        goal: null,
        deliveredAt: delivered ? new Date().toISOString() : null,
        deliveredByLogin: delivered ? this.actor.login : null,
      },
      canStartNext: delivered && this.canManageRequirements(),
      deliveredRepositories: heads
        .filter((head) => this.deliveredRepositories.has(head.projectId))
        .map((head) => ({
          projectId: head.projectId,
          repoFullName: head.repoFullName,
          how: 'merged',
          mergeSha: MERGE_SHA,
          prNumber: PROMOTION_PR.number,
        })),
      coveredRepositories: approved
        ? heads.map((head) => ({
            projectId: head.projectId,
            repoFullName: head.repoFullName,
            delivered: this.deliveredRepositories.has(head.projectId),
            how: this.deliveredRepositories.has(head.projectId)
              ? 'merged'
              : null,
          }))
        : [],
      canMergeAll: false,
    };
  }

  /**
   * The Project-level gate for a repository filed under a Project, with the
   * reasons of qa-promotion.rules.ts: the latest signed-off run must be
   * Approved, every item passed by QA and by the Product owner.
   */
  private projectPromotion(
    projectId: string,
    folder: FolderRow,
  ): QaPromotionStatusWire {
    const run = this.latestSignedOffRun(folder.id);
    const reasons: string[] = [];
    const itemCount = this.liveRequirements(folder.id).reduce(
      (sum, row) => sum + row.items.length,
      0,
    );
    if (itemCount === 0) reasons.push('This Project has no QA requirements');
    if (!run) {
      reasons.push('No QA run covers the current uat heads');
    } else {
      if (run.signoff?.verdict === 'REJECTED')
        reasons.push('Latest sign-off is Rejected');
      else if (run.signoff?.verdict === 'CONDITIONAL')
        reasons.push('Latest sign-off is Conditional (only Approved counts)');
      const notPassed = run.items.filter(
        (item) => item.status !== 'passed',
      ).length;
      if (notPassed > 0)
        reasons.push(
          `${notPassed === 1 ? '1 item' : `${String(notPassed)} items`} not passed in the signed-off QA run: a Product owner reopens the run so QA verifies them`,
        );
      const notAccepted = run.items.filter(
        (item) => item.poAcceptance.status !== 'passed',
      ).length;
      if (notAccepted > 0)
        reasons.push(
          notAccepted === 1
            ? '1 item is waiting for the Product owner to pass it'
            : `${String(notAccepted)} items are waiting for the Product owner to pass them`,
        );
    }
    const delivered = this.iterationDelivered(folder);
    return {
      qaBranch: QA_BRANCH,
      targetBranch: 'main',
      headSha: UAT_SHA,
      scope: 'project',
      deliveryProject: { id: folder.id, name: folder.name },
      run: run?.signoff
        ? {
            id: run.id,
            verdict: run.signoff.verdict,
            signedAt: run.signoff.signedAt,
            stale: false,
          }
        : null,
      repositories: this.folderHeads(folder).map((head) => ({
        projectId: head.projectId,
        repoFullName: head.repoFullName,
        runSha: run ? head.sha : null,
        currentSha: head.sha,
        moved: false,
      })),
      requirementsChanged: false,
      checklists: [],
      eligible: reasons.length === 0 && run?.signoff?.verdict === 'APPROVED',
      reasons,
      pullRequest: this.promotionPr
        ? { ...this.promotionPr, headSha: UAT_SHA }
        : null,
      canMerge: canMergePromotion(this.role),
      repositoryDelivered: this.deliveredRepositories.has(projectId),
      iterationDelivered: delivered,
      iteration: {
        id: `iteration-${folder.id}-1`,
        number: 1,
        status: delivered ? 'delivered' : 'active',
        deliveredAt: delivered ? new Date().toISOString() : null,
      },
    };
  }

  promotion(projectId: string): QaPromotionStatusWire {
    this.requireProject(projectId);
    const folder =
      this.projectQa === 'enabled' ? this.folderOfRepository(projectId) : null;
    if (folder) return this.projectPromotion(projectId, folder);
    const checklists = this.promotionChecklists(projectId);
    const reasons = this.promotionReasons(checklists);
    return {
      qaBranch: QA_BRANCH,
      targetBranch: 'main',
      headSha: UAT_SHA,
      checklists,
      eligible: reasons.length === 0,
      reasons,
      pullRequest: this.promotionPr
        ? { ...this.promotionPr, headSha: UAT_SHA }
        : null,
      canMerge: canMergePromotion(this.role),
    };
  }

  private mergePromotion(projectId: string): QaPromotionMergeWire {
    if (!canMergePromotion(this.role))
      throw nestError(403, 'Only a team lead or admin may merge to main.');
    const status = this.promotion(projectId);
    if (!status.eligible) {
      throw new HttpError(409, {
        code: 'QA_PROMOTION_BLOCKED',
        message:
          'QA has not approved every shared checklist on the current uat commit.',
        reasons: status.reasons,
      });
    }
    const pullRequest = this.promotionPr ?? PROMOTION_PR;
    if (this.mergeMode === 'refuse') {
      // GitHub refused: 200 with merged:false and its own words.
      return { merged: false, sha: null, message: GITHUB_REFUSAL, pullRequest };
    }
    this.promotionPr = null;
    this.deliveredRepositories.add(projectId);
    return {
      merged: true,
      sha: MERGE_SHA,
      message: 'Pull Request successfully merged',
      pullRequest,
    };
  }

  /* ── Assembly (row → contract) ── */

  private toRunItem(run: RunRow, row: ItemRow): QaRunItem {
    const { updatedAt: _updatedAt, ...fields } = row;
    return {
      ...fields,
      runId: run.id,
      canUpdate:
        run.status === 'open' &&
        personaAllowsRole(row.targetPersona, this.role),
      previous: null,
      automated: matchAutomated(row, this.automation),
    };
  }

  private summary(items: ItemRow[]) {
    const byStatus: Record<QaRunItemStatus, number> = {
      pending: 0,
      in_progress: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      returned_to_dev: 0,
    };
    let blockers = 0;
    for (const item of items) {
      byStatus[item.status] += 1;
      if (
        OPEN_DEFECT_STATUSES.includes(item.status) &&
        item.defectSeverity === 'blocker'
      )
        blockers += 1;
    }
    const openDefects = OPEN_DEFECT_STATUSES.reduce(
      (sum, status) => sum + byStatus[status],
      0,
    );
    return { total: items.length, byStatus, openDefects, blockers };
  }

  assembleRun(run: RunRow): QaRun {
    const open = run.status === 'open';
    return {
      id: run.id,
      projectId: PROJECT_ID,
      checklistId: run.checklistId,
      checklistName: run.checklistName,
      checklistVersion: run.checklistVersion,
      branch: run.branch,
      commitSha: run.commitSha,
      commitSource: 'deployment',
      status: run.status,
      createdBy: run.createdBy,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      summary: this.summary(run.items),
      signoff: run.signoff,
      items: [...run.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => this.toRunItem(run, item)),
      permissions: {
        canUpdateItems:
          open &&
          run.items.some((item) =>
            personaAllowsRole(item.targetPersona, this.role),
          ),
        canReturnToDev: open && canSetReturnedToDev(this.role),
        canRequestRetest: open && canRequestRetest(this.role),
        canSignOff: open && canSignOff(this.role),
        canReopen: !open && canReopenRun(this.role),
      },
      automation: this.automation,
    };
  }

  /** qa-report.service.ts + qa-report.mapper.ts: a signed-off run reports its frozen copy. */
  buildReport(runId: string): QaReport {
    const row = this.requireRun(runId);
    const run = row.frozen ?? this.assembleRun(row);
    const { byStatus, total, openDefects, blockers } = run.summary;
    const rank = (severity: QaDefectSeverity | null) =>
      severity === null ? 3 : { blocker: 0, major: 1, minor: 2 }[severity];
    return {
      schemaVersion: 'qa-report/v1',
      generatedAt: new Date().toISOString(),
      frozen: row.frozen !== null,
      project: {
        id: PROJECT_ID,
        repoFullName: PROJECTS[0].repoFullName,
        name: PROJECTS[0].serviceName,
      },
      run,
      summary: {
        totalItems: total,
        passed: byStatus.passed,
        failed: byStatus.failed,
        blocked: byStatus.blocked,
        returnedToDev: byStatus.returned_to_dev,
        pending: byStatus.pending,
        inProgress: byStatus.in_progress,
        completionRate:
          total > 0 ? Math.round((byStatus.passed / total) * 10000) / 10000 : 0,
        openDefects,
        blockers,
        verdict: run.signoff?.verdict ?? null,
      },
      defects: run.items
        .filter(
          (
            item,
          ): item is QaRunItem & {
            status: 'failed' | 'blocked' | 'returned_to_dev';
          } => OPEN_DEFECT_STATUSES.includes(item.status),
        )
        .map((item) => ({
          position: item.position,
          title: item.title,
          status: item.status,
          severity: item.defectSeverity,
          notes: item.notes,
          reproductionSteps: item.reproductionSteps,
          targetPersona: item.targetPersona,
          fixRequest: item.fixRequest,
        }))
        .sort(
          (a, b) =>
            rank(a.severity) - rank(b.severity) || a.position - b.position,
        ),
      automatedResults: run.automation ?? null,
      signoffHistory: [],
    };
  }

  /** The Markdown the report endpoint serves. The client copies it verbatim, so its exact text does not matter here. */
  reportMarkdown(runId: string): string {
    const report = this.buildReport(runId);
    const rows = report.run.items.map(
      (item) => `| ${item.position + 1} | ${item.title} | ${item.status} |`,
    );
    return [
      `# QA Report — ${report.project.repoFullName}`,
      '',
      `**Verdict:** ${report.summary.verdict ?? 'Not signed off'} · \`${report.run.branch}\` @ \`${report.run.commitSha.slice(0, 7)}\``,
      '',
      '| # | Item | Status |',
      '|---|------|--------|',
      ...rows,
      '',
    ].join('\n');
  }

  private report(runId: string, format: string | null): ApiReply {
    if (format === 'md')
      return {
        body: this.reportMarkdown(runId),
        contentType: 'text/markdown; charset=utf-8',
      };
    return { body: this.buildReport(runId) };
  }
}

/* ── Assertions ──────────────────────────────────────────────────────────── */

const WAIT_MS = 15_000;

async function eventually(
  description: string,
  check: () => Promise<boolean> | boolean,
  timeout = WAIT_MS,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeout}ms waiting for: ${description}`);
}

async function visible(locator: Locator, description: string) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: WAIT_MS });
  } catch (error) {
    throw new Error(`Expected to see ${description}`, { cause: error });
  }
}

async function absent(locator: Locator, description: string) {
  await eventually(
    `${description} to be absent`,
    async () => (await locator.count()) === 0,
  );
}

const API_QUIET_MS = 750;

/**
 * For a control that must never appear. Absence is only meaningful once the
 * app has what would show it, so this waits until capabilities were served
 * and the app has made no API call for API_QUIET_MS (every gate here renders
 * from a response, in the same task that receives it), then checks once.
 * Settles on the mock, not on 'networkidle': the dev server's own traffic and
 * the framed preview page are not the app waiting for data.
 */
async function neverShown(
  backend: QaMockBackend,
  locator: Locator,
  description: string,
  since = 0,
) {
  await eventually('the capabilities response to be served', () =>
    backend.calls.some(
      (call) => call.path === '/capabilities' && call.at >= since,
    ),
  );
  await eventually(
    `the app to stop calling the API for ${API_QUIET_MS}ms`,
    () => {
      const last = backend.calls.at(-1);
      return last !== undefined && Date.now() - last.at >= API_QUIET_MS;
    },
  );
  assert.equal(await locator.count(), 0, `${description} must not be shown`);
}

/** The DOM text, not innerText: CSS text-transform (the uppercase role badge) must not change what is asserted. */
async function textOf(locator: Locator): Promise<string> {
  return ((await locator.first().textContent()) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function expectText(
  locator: Locator,
  expected: string | RegExp,
  description: string,
) {
  await eventually(`${description} to read ${String(expected)}`, async () => {
    if ((await locator.count()) === 0) return false;
    const actual = await textOf(locator);
    return typeof expected === 'string'
      ? actual.includes(expected)
      : expected.test(actual);
  });
}

function onlyCall<T>(calls: T[], description: string): T {
  assert.equal(
    calls.length,
    1,
    `expected exactly one ${description}, saw ${calls.length}`,
  );
  return calls[0];
}

/* ── Page helpers ────────────────────────────────────────────────────────── */

/**
 * Opens QA Studio or PO Studio with its run rail pinned open. Unpinned, the
 * rail opens only under the pointer, and a journey works in the panel.
 */
async function openStudio(
  page: Page,
  baseUrl: string,
  tab: 'QA Studio' | 'PO Studio',
) {
  await openProjectTab(page, baseUrl, tab);
  const title = tab === 'QA Studio' ? 'QA checklist' : 'Acceptance';
  await page.getByRole('button', { name: `Keep ${title} open` }).click();
}

async function openProjectTab(page: Page, baseUrl: string, tab: string) {
  await page.goto(`${baseUrl}/projects/${PROJECT_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  await visible(
    tabs.getByRole('tab', { name: 'Overview' }),
    'the project section tabs',
  );
  if (tab !== 'Overview')
    await tabs.getByRole('tab', { name: tab, exact: true }).click();
}

/** The primary sidebar's link to a page (its label is always in the DOM, hidden by opacity). */
function sidebarLink(page: Page, label: string): Locator {
  return page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: label, exact: true });
}

/**
 * Opens the header's team picker (a button + listbox popover), reports whether
 * it offers the "Create workspace" (+) button, and closes it again with Escape.
 */
async function pickerOffersCreate(page: Page): Promise<boolean> {
  const trigger = page.getByRole('button', { name: /^Active workspace:/ });
  await visible(trigger, 'the workspace picker');
  await trigger.click();
  const listbox = page.getByRole('listbox', { name: 'Active workspace' });
  await visible(listbox, 'the open workspace picker');
  await visible(
    listbox.getByRole('option', { name: WORKSPACE.name, selected: true }),
    'the current team, marked selected',
  );
  const offers =
    (await page
      .getByRole('button', { name: 'Create workspace', exact: true })
      .count()) === 1;
  await page.keyboard.press('Escape');
  await absent(listbox, 'the open workspace picker');
  return offers;
}

/** Opens a page from the primary sidebar, as a person would, and waits for its URL. */
async function openSidebarPage(page: Page, label: string, pathname: string) {
  const link = sidebarLink(page, label);
  await visible(link, `the sidebar's ${label} link`);
  await link.click();
  await eventually(
    `the ${pathname} page`,
    () => new URL(page.url()).pathname === pathname,
  );
}

/* The team Checklists page left the sidebar (SIDEBAR_SHOWS_CHECKLISTS); its
 * route still works, so the journeys open it by URL. */
async function openChecklistsPage(page: Page, baseUrl: string) {
  await visible(sidebarLink(page, 'Projects'), 'the sidebar');
  assert.equal(
    await sidebarLink(page, 'Checklists').count(),
    0,
    'no Checklists entry in the sidebar',
  );
  await page.goto(`${baseUrl}/checklists`, { waitUntil: 'domcontentloaded' });
  await eventually(
    'the /checklists page',
    () => new URL(page.url()).pathname === '/checklists',
  );
}

async function expectRoleBadge(page: Page, role: AppRole) {
  const badge = page.locator(
    `.app-header-identity .sidebar-role-badge--${role}`,
  );
  await expectText(
    badge,
    ROLE_BADGES[role],
    `the header role badge for ${role}`,
  );
}

function runItem(page: Page, title: string): Locator {
  return page
    .locator('li.qa-run-item')
    .filter({ has: page.locator('.qa-run-item__title', { hasText: title }) });
}

/** The recorded status pill beside an item's title (not the Automated badge next to it). */

/* ── Journeys ────────────────────────────────────────────────────────────── */

interface JourneyContext {
  page: Page;
  context: BrowserContext;
  backend: QaMockBackend;
  baseUrl: string;
}

export interface Journey {
  id: string;
  title: string;
  backend: () => QaMockBackend;
  /** Browser permissions the journey needs (clipboard for Copy PR Markdown). */
  permissions?: string[];
  run: (ctx: JourneyContext) => Promise<void>;
}

/** Opens a Project's detail from the Projects page, as anyone would: its card's Manage. */
async function openProjectDetail(page: Page, baseUrl: string, name: string) {
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('li.pf-card').filter({
    has: page.locator('.pf-card__name', { hasText: new RegExp(`^${name}$`) }),
  });
  await visible(card, `the ${name} Project card`);
  await card.getByRole('button', { name: `Manage ${name}` }).click();
  await expectText(
    page.locator('.pf-detail__title'),
    name,
    `the ${name} detail`,
  );
  await visible(
    page.locator('section.rq-workspace'),
    'the Project QA workspace',
  );
}

const FEATURE = {
  name: 'Checkout with saved cards',
  stories: [
    'As a shopper, I can save a card',
    'As a shopper, I can pay with a saved card',
  ],
};
/** The second Feature journey (a) writes in the same New Feature dialog. */
const SECOND_FEATURE = 'Refunds to the saved card';

/**
 * (a) Product owner: the team checklist page points to the Projects; a
 * Project with no Feature nudges them, and the nudge opens New Feature, where
 * they write two Features at once (one with its first User stories) in ONE
 * batch request, then add one more story with acceptance criteria. The repository's Checklists tab points back
 * to the Project.
 */
async function leadWritesProjectRequirements({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'lead');
  // The contrast for journey (d): a lead's workspace picker offers creation.
  assert.equal(
    await pickerOffersCreate(page),
    true,
    'the workspace picker offers "Create workspace" to a lead',
  );
  // /teams is the header team's members now; checklists have a page of their own.
  await visible(
    page.getByRole('heading', { name: /^Members/ }),
    'the Members section on /teams',
  );
  await openChecklistsPage(page, baseUrl);
  await visible(
    page.getByText('No QA checklists yet'),
    'the empty checklist list',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Create the first checklist' })
      .count(),
    0,
    'no team checklist create',
  );
  await page.getByRole('link', { name: 'Open Projects' }).click();
  await eventually('the Projects page for this team', () => {
    const url = new URL(page.url());
    return (
      url.pathname === '/workflows' &&
      url.searchParams.get('group') === WORKSPACE.id
    );
  });

  // Features before repositories: a Project with no Feature nudges its
  // Product owner, and the nudge opens New Feature on that Project.
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  const storefrontCard = page.locator('li.pf-card').filter({
    has: page.locator('.pf-card__name', { hasText: /^storefront$/ }),
  });
  await expectText(
    storefrontCard,
    'Add a Feature so Developers can add repositories.',
    'the Product owner nudge',
  );
  assert.equal(
    await page.locator('.pf-card__add').count(),
    0,
    'no Add repository for a Product owner, blocked or not',
  );
  await storefrontCard
    .getByRole('button', { name: 'Add a Feature to storefront' })
    .click();
  await expectText(
    page.locator('.pf-detail__title'),
    'storefront',
    'the storefront detail',
  );
  await visible(
    page.getByRole('region', { name: 'Requirements' }),
    "a Product owner's one view, Requirements",
  );
  const features = page.locator('section.rq-section[data-kind="functional"]');
  const dialog = page.getByRole('dialog', { name: 'New Feature' });
  await visible(dialog, 'New Feature, opened by the nudge');
  // Landscape: the actions stay on screen; only the body scrolls.
  await visible(
    dialog
      .locator('.hier-dialog-footer')
      .getByRole('button', { name: 'Create feature' }),
    'the pinned Create',
  );

  // Two Features in one go, as a side list of tabs beside one editor: the
  // first with its stories, then "Add feature" for the second.
  const list = dialog.getByRole('tablist', { name: 'Features' });
  const tab = (name: string | RegExp, selected = true) =>
    list.getByRole('tab', { name, selected });
  const firstTab = new RegExp(`^${FEATURE.name}`);
  await visible(
    tab(/^Untitled feature/),
    'the first Feature, open and untitled',
  );
  const editor = dialog.getByRole('tabpanel');
  const name = editor.getByPlaceholder('Checkout with saved cards');
  await name.fill(FEATURE.name);
  await visible(tab(firstTab), 'the tab named as the Name is typed');
  // One input per story: type, Enter for the next row, type.
  const story = (index: number) =>
    editor.getByRole('textbox', { name: `User story ${index}`, exact: true });
  await story(1).fill(FEATURE.stories[0]);
  await story(1).press('Enter');
  await story(2).fill(FEATURE.stories[1]);
  await expectText(tab(firstTab), '2 stories', 'the story count on the tab');
  await dialog.getByRole('button', { name: 'Add feature' }).click();
  await visible(tab(/^Untitled feature/), 'the second Feature, open');
  await name.fill(SECOND_FEATURE);
  await visible(tab(new RegExp(`^${SECOND_FEATURE}`)), 'the second tab, named');
  // Ctrl+Enter adds a third; left empty, it is ignored.
  await name.press('Control+Enter');
  await eventually(
    'a third Feature from Ctrl+Enter',
    async () => (await list.getByRole('tab').count()) === 3,
  );
  await visible(tab(/^Untitled feature/), 'the third Feature, open');
  // Home goes back to the first, its stories as typed.
  await list.getByRole('tab', { selected: true }).press('Home');
  await visible(tab(firstTab), 'Home opens the first Feature');
  assert.equal(
    await story(2).inputValue(),
    FEATURE.stories[1],
    'the first Feature keeps its stories',
  );
  await dialog.getByRole('button', { name: 'Create 2 features' }).click();
  await absent(dialog, 'the New Feature dialog');
  assert.equal(
    backend.callsTo(
      'POST',
      new RegExp(`^/delivery-projects/${STOREFRONT_FOLDER}/requirements$`),
    ).length,
    0,
    'never one request per Feature',
  );
  const create = onlyCall(
    backend.callsTo(
      'POST',
      new RegExp(
        `^/delivery-projects/${STOREFRONT_FOLDER}/requirements/batch$`,
      ),
    ),
    'batch create',
  );
  assert.equal(create.status, 201);
  assert.deepEqual(create.body, {
    kind: 'functional',
    requirements: [
      {
        name: FEATURE.name,
        items: FEATURE.stories.map((title) => ({ title })),
      },
      { name: SECOND_FEATURE },
    ],
  });
  const card = features
    .locator('article.rq-card')
    .filter({ hasText: FEATURE.name });
  await expectText(
    card.locator('.rq-meter__label'),
    '0 of 2 done',
    'the new Feature progress',
  );
  await visible(
    features.locator('article.rq-card').filter({ hasText: SECOND_FEATURE }),
    'the second new Feature',
  );
  // The nudge goes as soon as the Project has a Feature.
  await eventually(
    'the nudge to leave',
    async () => (await page.locator('.pf-nudge').count()) === 0,
  );

  // A Feature opens on its title to show its stories and Add user story.
  await card.getByRole('button', { name: FEATURE.name }).click();
  await card.getByRole('button', { name: 'Add user story' }).click();
  await card
    .getByLabel('User story', { exact: true })
    .fill('As a shopper, I can remove a saved card');
  await card
    .getByLabel('Acceptance criteria (optional)')
    .fill('Given a saved card\nWhen I remove it\nThen it is gone');
  await card
    .locator('form.rq-item-form')
    .getByRole('button', { name: 'Add user story' })
    .click();
  await expectText(
    card.locator('.rq-meter__label'),
    '0 of 3 done',
    'three stories now',
  );
  const add = onlyCall(
    backend.callsTo('POST', /^\/requirements\/[^/]+\/items$/),
    'story create',
  );
  assert.deepEqual(add.body, {
    title: 'As a shopper, I can remove a saved card',
    acceptanceCriteria: 'Given a saved card\nWhen I remove it\nThen it is gone',
    verificationType: 'manual',
    testIdentifier: null,
  });
  assert.equal(
    backend.callsTo('PUT', /^\/qa-checklists\//).length,
    0,
    'never the legacy delete-and-reinsert',
  );

  // A Product owner's Checklists tab carries the Project's QA itself: the
  // same Requirements, no pointer out to the Projects page.
  await openProjectTab(page, baseUrl, 'Checklists');
  const panel = page.locator('#project-detail-panel-checklists');
  await visible(
    panel.getByRole('region', { name: 'Requirements' }),
    "the Project's QA workspace in the Checklists tab",
  );
  await expectText(
    panel
      .locator('article.rq-card')
      .filter({ hasText: FEATURE.name })
      .locator('.rq-meter__label'),
    '0 of 3 done',
    'the same Feature, here too',
  );
  assert.equal(
    await page.getByText('Requirements belong to the Project').count(),
    0,
    'no pointer to the Projects page',
  );
  assert.equal(
    await page.getByRole('link', { name: 'Open team checklists' }).count(),
    0,
    'no team checklist link',
  );
}

/* Four Features of three Done stories each: a Project run as long as a real one. */
const LONG_PROJECT_FEATURES = [
  'Cold-chain consignment intake & constraint definition',
  'Fleet compatibility checking & dispatch allocation',
  'Real-time cold-chain telemetry & breach alerting',
  'Geofenced delivery handoff & digital proof of delivery (POD)',
];

function seedLongProject(backend: QaMockBackend) {
  for (const name of LONG_PROJECT_FEATURES) {
    backend.seedRequirement(STOREFRONT_FOLDER, {
      kind: 'functional',
      name,
      items: [1, 2, 3].map((n) => ({
        title: `${name}: user story ${String(n)}`,
        acceptanceCriteria:
          'Given a consignment\nWhen it is registered\nThen its constraints are kept',
        progress: 'done' as const,
      })),
    });
  }
}

/** Saves a named screenshot when E2E_QA_SHOTS names a directory (for looking, not asserting). */
async function shot(page: Page, name: string) {
  const dir = process.env.E2E_QA_SHOTS;
  if (!dir) return;
  // Let entrance animations (the drawer fades in) finish, or the shot catches them half-drawn.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished),
    ),
  );
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

/**
 * The studio's run column holds a long Project run inside its rail: the
 * selected tab's panel scrolls as one rather than spilling past the bottom
 * of the viewport (the sign-off banner and the requirement groups used to
 * run off it).
 */
async function expectRunColumnContained(
  page: Page,
  description: string,
  options: { long: boolean },
) {
  const column = await page.evaluate(() => {
    const run = document.querySelector('.qa-studio__run');
    const panel = document.querySelector(
      '.qa-studio__run > .qa-colpanel:not([hidden])',
    );
    if (!run || !panel) return null;
    return {
      overflowY: getComputedStyle(panel).overflowY,
      overflows: panel.scrollHeight > panel.clientHeight + 1,
      bottom: run.getBoundingClientRect().bottom,
      viewportBottom: window.innerHeight,
    };
  });
  assert.ok(column, `${description}: the studio column`);
  assert.equal(
    column.overflowY,
    'auto',
    `${description}: the column scrolls its overflow instead of spilling it`,
  );
  if (options.long)
    assert.ok(
      column.overflows,
      `${description}: the long run is taller than the column, so it scrolls`,
    );
  assert.ok(
    column.bottom <= column.viewportBottom + 1,
    `${description}: the column ends inside the viewport (${String(column.bottom)} vs ${String(column.viewportBottom)})`,
  );
}

/** Opens every folded Feature or System group of the run in the studio column. */
async function openAllRunGroups(page: Page) {
  const folded = page.locator(
    '.qa-studio__run .pqa-group__head button[aria-expanded="false"]',
  );
  while ((await folded.count()) > 0) await folded.first().click();
}

/** (n) QA Team: a twelve-item Project run stays inside QA Studio's column. */
async function qaLongProjectRunFits({ page, baseUrl }: JourneyContext) {
  await openStudio(page, baseUrl, 'QA Studio');
  await expectRoleBadge(page, 'qa');
  await eventually(
    'the four requirement groups',
    async () =>
      (await page.locator('.qa-studio__run .pqa-group').count()) === 4,
  );
  await openAllRunGroups(page);
  await expectRunColumnContained(page, 'QA Studio', { long: true });
  // Each heading on one row where it fits: kind, name and count side by side.
  const head = page.locator('.pqa-group__head').first();
  const [kind, count] = [
    await head.locator('.pqa-kind').boundingBox(),
    await head.locator('.pqa-group__progress').boundingBox(),
  ];
  assert.ok(
    kind && count && Math.abs(kind.y - count.y) < 12,
    'the kind and the count share the heading row',
  );
  await shot(page, 'n-qa-studio');

  // Full screen re-lays out the same rail over the viewport: it scrolls the
  // same way and keeps its header at the top.
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expectRunColumnContained(page, 'QA Studio in full screen', {
    long: true,
  });
  const run = page.locator('.qa-studio__run');
  await run.locator('> .qa-colpanel:not([hidden])').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const [runBox, headBox] = [
    await run.boundingBox(),
    await run.locator('.qa-drawer__head').boundingBox(),
  ];
  assert.ok(
    runBox && headBox && Math.abs(headBox.y - runBox.y) < 2,
    'the column header stays at the top while its column scrolls',
  );
  await shot(page, 'n-qa-full-screen');
}

/** (o) Team lead: PO Studio holds the readiness chip, Merge to main and a long acceptance in one scrolling column. */
async function leadAcceptanceFits({ page, baseUrl }: JourneyContext) {
  await openStudio(page, baseUrl, 'PO Studio');
  await expectRoleBadge(page, 'lead');
  const column = page.locator('.qa-studio__run');
  // The acceptance lists every item for the Product owner's own check.
  const check = column.getByRole('region', { name: 'Your check' });
  await expectText(check, '0 of 12 passed by you', "the Product owner's check");
  await expectRunColumnContained(page, 'PO Studio', { long: true });
  // The readiness chip and Merge to main sit in the column's header, in view
  // however far the acceptance scrolls.
  const head = column.locator('.qa-drawer__head');
  await visible(
    head.getByRole('button', { name: 'Ready for production' }),
    'the readiness chip',
  );
  const merge = head.getByRole('button', { name: 'Merge to main' });
  await visible(merge, 'Merge to main');
  await column.locator('> .qa-colpanel:not([hidden])').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const [mergeBox, columnBox] = [
    await merge.boundingBox(),
    await column.boundingBox(),
  ];
  assert.ok(
    mergeBox &&
      columnBox &&
      mergeBox.y >= columnBox.y &&
      mergeBox.y + mergeBox.height <= columnBox.y + columnBox.height,
    'Merge to main stays inside the visible column',
  );
  await shot(page, 'o-po-studio');
}

/** (k) Developer: reads the Project's requirements, can only move Progress; Done reaches QA's queue. */
async function developerMovesProgress({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  // A Developer works from a repository's Checklists tab: the Project page
  // leaves the workspace out once the Project has a repository.
  await openProjectTab(page, baseUrl, 'Checklists');
  await expectRoleBadge(page, 'member');
  const workspace = page.locator('section.rq-workspace');
  await visible(workspace, 'the Project QA workspace');
  const features = page.locator('section.rq-section[data-kind="functional"]');
  await expectText(features, FEATURE.name, 'the seeded Feature');
  await neverShown(
    backend,
    page.getByRole('button', { name: 'New Feature' }),
    'New Feature for a Developer',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Add user story' }).count(),
    0,
    'no Add user story for a Developer',
  );
  assert.equal(
    await page.locator('button[aria-label^="Move "]').count(),
    0,
    'no reorder for a Developer',
  );

  // A Feature opens on its title to show its stories.
  await features.getByRole('button', { name: FEATURE.name }).click();
  const group = page.getByRole('group', {
    name: `Progress of ${FEATURE.stories[0]}`,
  });
  // Controlled: the radio reads Done once the server has answered.
  await group.getByRole('radio', { name: 'Done' }).click();
  await visible(
    page.getByText('QA has been told this is ready.'),
    'the ready-for-QA confirmation',
  );
  const progress = onlyCall(
    backend.callsTo('PATCH', /^\/requirements\/[^/]+\/items\/[^/]+\/progress$/),
    'Progress write',
  );
  assert.deepEqual(progress.body, { progress: 'done', expectedRowVersion: 1 });

  // One view, no tabs: the checklist itself shows the story moved on.
  assert.equal(
    await workspace.getByRole('tab').count(),
    0,
    'no Requirements | Progress | QA testing tabs for a Developer',
  );
  assert.ok(
    await group.getByRole('radio', { name: 'Done' }).isChecked(),
    'the story reads Done on the checklist',
  );
}

/**
 * (l) QA Team: one run for the whole Project. Passed is not offered until a
 * Developer marked the story Done; Failed needs a severity and returns the
 * story to the Developers; no sign-off while an item is failed.
 */
async function qaVerifiesProject({ page, backend, baseUrl }: JourneyContext) {
  await openProjectDetail(page, baseUrl, 'storefront');
  await expectRoleBadge(page, 'qa');
  await visible(
    page.getByRole('region', { name: 'QA testing' }),
    "the QA Team's one view, its run",
  );
  await page.getByRole('button', { name: 'Start QA testing' }).click();
  const start = onlyCall(
    backend.callsTo(
      'POST',
      new RegExp(`^/delivery-projects/${STOREFRONT_FOLDER}/qa-runs$`),
    ),
    'Project run start',
  );
  assert.deepEqual(
    start.body,
    {},
    'no body: the server reads every repository head',
  );
  // One Verification select per story: Pending, Passed, Failed.
  const verify = (position: number) =>
    page.getByRole('combobox', { name: `Verification of item ${position}` });
  await visible(verify(2), 'both run items');
  const offered = async (position: number) =>
    verify(position)
      .locator('option:not([disabled])')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
  assert.ok((await offered(1)).includes('passed'), 'Passed for the Done story');
  assert.ok(!(await offered(2)).includes('passed'), 'no Passed before Done');
  await visible(
    page.getByText('A Developer marks this Done before QA can pass it.'),
    'why Passed is missing',
  );

  await verify(1).selectOption('passed');
  await eventually(
    'the Passed write',
    () =>
      backend.callsTo(
        'PATCH',
        /^\/delivery-projects\/[^/]+\/qa-runs\/[^/]+\/items\/[^/]+$/,
      ).length === 1,
  );
  const passed = backend.callsTo(
    'PATCH',
    /^\/delivery-projects\/[^/]+\/qa-runs\/[^/]+\/items\/[^/]+$/,
  )[0];
  assert.deepEqual(passed.body, { status: 'passed', expectedRowVersion: 1 });

  // Failed asks for a severity first, and sends the story back to the Developers.
  await verify(2).selectOption('failed');
  const editor = page.locator('.pqa-run form.qa-item-editor');
  await visible(
    editor.getByText(
      'Failed sends this story back to the Developers: its Progress returns to In progress.',
    ),
    'what Failed does',
  );
  await editor.getByLabel(/Severity/).selectOption('major');
  await editor
    .getByLabel('Notes')
    .fill('The saved card is not offered at checkout.');
  await editor.getByRole('button', { name: 'Mark Failed' }).click();
  await absent(editor, 'the item editor');
  const returned = backend.callsTo(
    'PATCH',
    /^\/delivery-projects\/[^/]+\/qa-runs\/[^/]+\/items\/[^/]+$/,
  )[1];
  assert.deepEqual(returned.body, {
    status: 'failed',
    expectedRowVersion: 1,
    notes: 'The saved card is not offered at checkout.',
    defectSeverity: 'major',
  });
  // The failed story went back to the Developers.
  await visible(
    page.getByText('Progress: In progress'),
    'the failed story back In progress',
  );

  // No sign-off while an item is failed: the server refuses
  // (QA_RUN_OPEN_DEFECTS), so the page says why and holds the button.
  await visible(
    page.getByText(
      '1 item is failed, blocked or returned to dev. Sign off once QA has verified the fix.',
    ),
    'why sign-off waits',
  );
  assert.ok(
    await page
      .getByRole('button', { name: 'Sign off', exact: true })
      .isDisabled(),
    'Sign off held while an item is failed',
  );
}

/**
 * (b) QA Team, in QA Studio on uat: writes a test case under a story, which
 * holds the story's Passed until the test case passes; passes both stories;
 * signs the Project run off Approved.
 */
async function qaVerifiesAndSignsOff({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await openStudio(page, baseUrl, 'QA Studio');
  await expectRoleBadge(page, 'qa');
  // uat is the only QA environment: one deployment of it needs no control.
  assert.equal(
    await page.getByRole('combobox', { name: 'Environment' }).count(),
    0,
    'no environment picker for a single uat deployment',
  );
  await page.getByRole('button', { name: 'Start QA testing' }).click();
  onlyCall(
    backend.callsTo('POST', /^\/delivery-projects\/[^/]+\/qa-runs$/),
    'Project run start',
  );

  // Test cases are written in the test suite editor, apart from the evidence.
  await page.getByRole('button', { name: 'Create test cases' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit test suite' });
  await visible(editor, 'the test suite editor');
  const suite = editor.getByRole('group', {
    name: `Test cases for ${FEATURE.stories[0]}`,
  });
  await suite.getByRole('button', { name: '+ Add test case category' }).click();
  await suite
    .getByRole('textbox', { name: 'Category', exact: true })
    .fill('Happy path');
  await suite.getByRole('button', { name: 'Add category' }).click();
  // The form closes once the server has the category.
  await visible(
    suite.getByRole('heading', { name: 'Happy path' }),
    'the new category',
  );
  await absent(
    suite.getByRole('form', { name: 'New test case category' }),
    'the category form',
  );
  await suite
    .getByRole('button', { name: '+ Add test case', exact: true })
    .click();
  await suite
    .getByRole('textbox', { name: 'Test case', exact: true })
    .fill('Pay with the saved Visa');
  await suite
    .getByRole('textbox', { name: 'Expected result (optional)' })
    .fill('The order is placed with the saved card');
  await suite
    .getByRole('button', { name: 'Add test case', exact: true })
    .click();
  await expectText(
    editor.getByRole('status'),
    'All changes saved',
    'the editor saved',
  );
  assert.deepEqual(
    onlyCall(backend.callsTo('POST', /\/test-categories$/), 'category create')
      .body,
    { name: 'Happy path' },
  );
  assert.deepEqual(
    onlyCall(
      backend.callsTo('POST', /\/test-categories\/[^/]+\/test-cases$/),
      'test case create',
    ).body,
    {
      title: 'Pay with the saved Visa',
      expectedResult: 'The order is placed with the saved card',
    },
  );
  await editor.getByRole('button', { name: 'Done' }).click();
  await page
    .getByRole('alertdialog', { name: "Are you sure you're done?" })
    .getByRole('button', { name: "Yes, I'm done" })
    .click();
  await absent(editor, 'the test suite editor');

  // The story cannot pass while its test case is open.
  const verify = (position: number) =>
    page.getByRole('combobox', { name: `Verification of item ${position}` });
  const offered = async (position: number) =>
    verify(position)
      .locator('option:not([disabled])')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
  await visible(
    page.getByText(
      'Pass every test case of this story before passing the story.',
    ),
    'why Passed waits',
  );
  assert.ok(
    !(await offered(1)).includes('passed'),
    'no Passed while a test case is open',
  );

  // Pass the test case, then the story.
  await page
    .getByRole('combobox', { name: 'Result of Pay with the saved Visa' })
    .selectOption('passed');
  const result = onlyCall(
    backend.callsTo(
      'PATCH',
      /^\/delivery-projects\/[^/]+\/qa-runs\/[^/]+\/items\/[^/]+\/test-cases\/[^/]+$/,
    ),
    'test case result',
  );
  assert.deepEqual(result.body, { status: 'passed', expectedRowVersion: 1 });
  await eventually('Passed offered for the story', async () =>
    (await offered(1)).includes('passed'),
  );
  await verify(1).selectOption('passed');
  await verify(2).selectOption('passed');
  await expectText(
    page.locator('.qa-studio__run'),
    '2/2 passed',
    'both stories passed',
  );

  // Sign off Approved.
  await page.getByRole('button', { name: 'Sign off', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign off this run' });
  await dialog.getByRole('radio', { name: /Approved/ }).check();
  await dialog.getByRole('button', { name: 'Sign off', exact: true }).click();
  await absent(dialog, 'the sign-off dialog');
  assert.deepEqual(
    onlyCall(
      backend.callsTo(
        'POST',
        /^\/delivery-projects\/[^/]+\/qa-runs\/[^/]+\/signoff$/,
      ),
      'Project sign-off',
    ).body,
    { verdict: 'APPROVED' },
  );
  await visible(page.locator('.qa-signoff-banner'), 'the signed-off banner');
}

/** (c) A developer fixes what QA returned and asks for a re-test. */
async function developerRequestsRetest({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await openProjectTab(page, baseUrl, 'Overview');
  await expectRoleBadge(page, 'member');
  // A Developer has no QA Studio, only the Project's progress.
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  assert.equal(
    await tabs.getByRole('tab', { name: 'QA Studio' }).count(),
    0,
    'no QA Studio tab for a Developer',
  );
  // The Overview carries only a summary: a count per state and a way in.
  const states = page.getByRole('list', { name: 'Progress by state' });
  const count = (state: string) =>
    states.getByRole('listitem').filter({ hasText: state });
  await expectText(count('Returned'), '1', 'the story QA failed');
  await expectText(count('Ready for QA'), '1', 'the story QA has yet to check');
  await page.getByRole('button', { name: 'Open progress' }).click();
  await visible(
    tabs.getByRole('tab', { name: 'Checklists', selected: true }),
    'the Checklists tab, opened from the summary',
  );

  // The failed story is back In progress, with what QA found.
  const features = page.locator('section.rq-section[data-kind="functional"]');
  await features.getByRole('button', { name: FEATURE.name }).click();
  await visible(
    page.getByText('The saved card is not offered at checkout.'),
    "QA's note on the failed story",
  );
  const group = page.getByRole('group', {
    name: `Progress of ${FEATURE.stories[0]}`,
  });
  assert.ok(
    await group.getByRole('radio', { name: 'In progress' }).isChecked(),
    'the failed story reads In progress',
  );

  // Fixed: Done hands it back to QA (request-retest is an alias for this).
  await group.getByRole('radio', { name: 'Done' }).click();
  await visible(
    page.getByText('QA has been told this is ready.'),
    'the ready-for-QA confirmation',
  );
  const progress = onlyCall(
    backend.callsTo('PATCH', /^\/requirements\/[^/]+\/items\/[^/]+\/progress$/),
    'Progress write',
  );
  assert.deepEqual(progress.body, { progress: 'done', expectedRowVersion: 2 });
  assert.equal(
    backend.callsTo('POST', /\/request-retest$/).length,
    0,
    'never the legacy per-repository re-test',
  );
}

/** (d) A QA Team member sees their badge, cannot create a workspace or manage checklists. */
async function qaTeamCannotCreate({ page, backend, baseUrl }: JourneyContext) {
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'qa');
  assert.equal(
    await pickerOffersCreate(page),
    false,
    'QA Team cannot create a workspace',
  );
  assert.equal(
    await page.getByTestId('create-workspace-button').count(),
    0,
    'no create-workspace button',
  );

  // QA Team reads the roster but cannot change it.
  await visible(page.getByText('Tone Lead').first(), 'the team roster');
  await neverShown(
    backend,
    page.getByRole('button', { name: 'Add member' }),
    'Add member for QA Team',
  );

  // Checklists are readable, not writable, for QA Team.
  await openChecklistsPage(page, baseUrl);
  const row = page
    .locator('button.qa-list-row')
    .filter({ hasText: RELEASE_CHECKLIST.name });
  await visible(row, 'the team checklist');
  await neverShown(
    backend,
    page.getByRole('button', { name: 'New checklist' }),
    'New checklist for QA Team',
  );
  await row.click();
  await expectText(
    page.locator('article.qa-detail .qa-detail__title'),
    RELEASE_CHECKLIST.name,
    'the checklist detail',
  );
  for (const action of ['Edit checklist', 'Share', 'Archive']) {
    await neverShown(
      backend,
      page.getByRole('button', { name: action, exact: true }),
      `${action} for QA Team`,
    );
  }

  // Activity & audit is for the team's leads (the server answers 403), so the
  // sidebar does not offer it; typed in, the page says so instead of failing.
  await neverShown(
    backend,
    sidebarLink(page, 'Activity'),
    "the sidebar's Activity link for QA Team",
  );
  assert.equal(
    backend.callsTo('GET', /\/activity$/).length,
    0,
    'nothing asked for the activity feed',
  );
  backend.activityForbiddenArmed = true;
  await page.goto(`${baseUrl}/activity`, { waitUntil: 'domcontentloaded' });
  await visible(
    page.getByText('The activity feed is available to group leads.'),
    'the activity access message',
  );
}

/** (e) The capabilities response lacks qaChecklists: every QA surface is gone. */
async function capabilityAbsentHidesQa({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await openProjectTab(page, baseUrl, 'Overview');
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  await visible(
    tabs.getByRole('tab', { name: 'Settings' }),
    'the rest of the tab strip',
  );
  // A Product owner's strip is Overview, Checklists, QA Studio, Audit and
  // Settings; without the capability, Overview, Audit and Settings.
  assert.deepEqual(
    await tabs.getByRole('tab').allTextContents(),
    ['Overview', 'Audit', 'Settings'],
    "a Product owner's tabs",
  );
  // A deep link to a tab the role does not get lands on Overview.
  await page.goto(`${baseUrl}/projects/${PROJECT_ID}#hosting`, {
    waitUntil: 'domcontentloaded',
  });
  await visible(
    tabs.getByRole('tab', { name: 'Overview', selected: true }),
    'Overview for a #hosting deep link',
  );

  // Audit: newest first, in words, who and when, the Project tag, Load more.
  await tabs.getByRole('tab', { name: 'Audit', exact: true }).click();
  const trail = page.locator('section.audit-trail');
  const rows = trail.locator('li.audit-trail__row');
  await eventually('two audit rows', async () => (await rows.count()) === 2);
  await expectText(
    rows.nth(0),
    'Requirement added',
    'the newest event, in words',
  );
  await expectText(
    rows.nth(0).locator('.audit-trail__tag'),
    'Project',
    'the Project tag',
  );
  await expectText(
    rows.nth(0).locator('.audit-trail__actor'),
    PEOPLE.lead.login,
    'who did it',
  );
  assert.equal(
    await rows.nth(0).locator('time').getAttribute('datetime'),
    '2026-10-01T09:00:00.000000+00:00',
  );
  assert.ok(
    await rows.nth(0).locator('time').getAttribute('title'),
    'the exact time on hover',
  );
  await expectText(rows.nth(1), 'Pull request merged', 'the second event');
  await trail.getByRole('button', { name: 'Load more' }).click();
  await eventually(
    'the older page appended',
    async () => (await rows.count()) === 3,
  );
  await expectText(rows.nth(2), 'Repository created', 'the oldest event');
  await expectText(
    rows.nth(2).locator('.audit-trail__actor'),
    'System',
    'a system event',
  );
  await absent(
    trail.getByRole('button', { name: 'Load more' }),
    'Load more on the last page',
  );
  const auditCalls = backend.callsTo('GET', /^\/projects\/project-1\/audit$/);
  assert.deepEqual(
    auditCalls.map((call) => [
      call.query.get('limit'),
      call.query.get('before'),
    ]),
    [
      ['50', null],
      ['50', '2026-09-30T09:00:00.123456+00:00'],
    ],
    'the cursor goes back unchanged',
  );
  // GitHub activity: the last read failed, so the sync line says so; Sync now
  // asks the server to read GitHub and re-reads the first page.
  await expectText(
    trail.locator('.audit-trail__sync'),
    "Couldn't reach GitHub just now",
    'the GitHub sync line',
  );
  await trail.getByRole('button', { name: 'Sync now' }).click();
  await eventually(
    'the sync request',
    () =>
      backend.callsTo('POST', /^\/projects\/project-1\/audit\/sync$/).length ===
      1,
  );
  await eventually(
    'the first page re-read',
    async () => (await rows.count()) === 2,
  );
  await expectText(
    trail.locator('.audit-trail__sync'),
    'GitHub activity synced',
    'the sync line after a sync',
  );
  await tabs.getByRole('tab', { name: 'Overview', exact: true }).click();
  // Positive control: the Overview only asks for previews once it has read a
  // capabilities response (previewDeployments), so the flags are applied.
  await eventually(
    'the capability-gated previews request',
    () =>
      backend.callsTo('GET', /^\/projects\/project-1\/previews$/).length > 0,
  );
  for (const hidden of ['Checklists', 'QA Studio']) {
    await neverShown(
      backend,
      tabs.getByRole('tab', { name: hidden, exact: true }),
      `the ${hidden} tab`,
    );
  }
  // A returned item exists on the server, but without the capability the card is not drawn.
  await neverShown(
    backend,
    page.getByRole('heading', { name: /Returned by QA/ }),
    'the Returned by QA card',
  );

  const teamsLoadedAt = Date.now();
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await visible(
    page.getByRole('heading', { name: /^Members/ }),
    'the Members section',
  );
  // The sidebar drops Checklists without the capability, and Activity is
  // hidden for everyone (SIDEBAR_SHOWS_ACTIVITY), even for a lead who may read it.
  await neverShown(
    backend,
    sidebarLink(page, 'Checklists'),
    "the sidebar's Checklists link",
    teamsLoadedAt,
  );
  await neverShown(
    backend,
    sidebarLink(page, 'Activity'),
    "the sidebar's Activity link",
    teamsLoadedAt,
  );
  // The route still works: typed in, a lead's Activity opens on its card, with no hero above it.
  await page.goto(`${baseUrl}/activity`, { waitUntil: 'domcontentloaded' });
  await eventually(
    'the /activity page',
    () => new URL(page.url()).pathname === '/activity',
  );
  await visible(
    page.getByRole('heading', { level: 2, name: 'Activity & audit' }),
    'the Activity & audit card',
  );
  await visible(page.getByText('No activity yet'), 'the empty activity feed');
  assert.equal(
    await page.locator('.workflow-page-header').count(),
    0,
    'no hero container on /activity',
  );

  // Typed straight in, /checklists says the feature is off instead of loading it.
  await page.goto(`${baseUrl}/checklists`, { waitUntil: 'domcontentloaded' });
  await visible(
    page.getByText('QA checklists are not switched on for this deployment.'),
    'the checklists-off notice',
  );

  // Nothing QA was even asked for: the tabs are hidden because the flag is
  // missing, not because a QA request failed.
  assert.deepEqual(
    backend.calls
      .filter((call) => /qa-/.test(call.path))
      .map((call) => call.path),
    [],
  );
}

/** (h) Team lead: the project explorer — list, open, attach, move (409 then real), archive, create links. */
/**
 * A multi-repository Project reads as one product for a Team lead: its card
 * opens the frontend's page, titled with the Project, with the sections in the
 * title row and no switch to the backend. The Checklists tab carries the
 * Project's QA, so there is no "Manage project" either; in the Projects
 * explorer only the frontend's chip opens a page.
 */
async function leadSwitchesRepositories({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'lead');
  const storefront = page.locator('li.pf-card').filter({
    has: page.locator('.pf-card__name', { hasText: /^storefront$/ }),
  });
  await storefront.locator('a.pf-card__open').click();
  await eventually(
    'the storefront frontend page',
    () => new URL(page.url()).pathname === `/projects/${PROJECT_ID}`,
  );

  const header = page.locator('.project-folder-header');
  await expectText(header.locator('h1'), 'storefront', 'the Project title');
  await expectText(
    header.locator('.project-folder-header__repo'),
    'tone/storefront-web',
    'the frontend subtitle',
  );
  const tabs = header.getByRole('tablist', { name: 'Project sections' });
  await visible(tabs, 'the sections in the title row');
  await neverShown(
    backend,
    page.getByRole('radiogroup', { name: 'Repositories in storefront' }),
    'the repository switch for a Team lead',
  );
  assert.equal(
    await page.getByRole('link', { name: 'Manage project' }).count(),
    0,
    'no Manage project for a Team lead',
  );

  // The Project's QA lives in the Checklists tab itself.
  await tabs.getByRole('tab', { name: 'Checklists', exact: true }).click();
  const panel = page.locator('#project-detail-panel-checklists');
  await visible(
    panel.getByRole('region', { name: 'Requirements' }),
    "the Project's QA workspace in the Checklists tab, a Product owner's Requirements",
  );

  // The explorer's Manage view: the frontend opens, the backend is a label.
  await page.goto(
    `${baseUrl}/workflows?group=${WORKSPACE.id}&project=${STOREFRONT_FOLDER}`,
    { waitUntil: 'domcontentloaded' },
  );
  await expectText(
    page.locator('.pf-detail__title'),
    'storefront',
    'the Project detail',
  );
  const chips = page.locator('.pf-repo .pf-chip');
  await eventually(
    'both repository chips',
    async () => (await chips.count()) === 2,
  );
  assert.equal(
    await chips.filter({ hasText: 'storefront-web' }).getAttribute('href'),
    `/projects/${PROJECT_ID}`,
    'the frontend chip opens its page',
  );
  assert.equal(
    await page
      .locator('.pf-repo a.pf-chip')
      .filter({ hasText: 'orders-api' })
      .count(),
    0,
    'the backend chip is not a link',
  );
  assert.equal(
    backend.callsTo('GET', /^\/projects\/project-2\/overview$/).length,
    0,
    'the backend page was never opened',
  );

  // An old link from before the split still lands on the same detail.
  await page.goto(
    `${baseUrl}/teams?workspace=${WORKSPACE.id}&section=projects&project=${STOREFRONT_FOLDER}`,
    { waitUntil: 'domcontentloaded' },
  );
  await eventually('the old /teams link to be forwarded to /workflows', () => {
    const url = new URL(page.url());
    return (
      url.pathname === '/workflows' &&
      url.searchParams.get('project') === STOREFRONT_FOLDER
    );
  });
  await expectText(
    page.locator('.pf-detail__title'),
    'storefront',
    'the Project detail opened by the old link',
  );
}

async function leadOrganisesProjects({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'lead');
  // The team rail is gone: /teams is members only, and Projects is the sidebar's.
  assert.equal(
    await page.getByRole('tablist', { name: 'Team sections' }).count(),
    0,
    'no team section rail',
  );
  // The team Checklists page left the sidebar (SIDEBAR_SHOWS_CHECKLISTS).
  await visible(sidebarLink(page, 'Projects'), "the sidebar's Projects link");
  assert.equal(
    await sidebarLink(page, 'Checklists').count(),
    0,
    'no Checklists entry in the sidebar',
  );
  await openSidebarPage(page, 'Projects', '/workflows');

  // One heading, the team's Project count beside it; no team dropdown.
  const heading = page.locator('.current-projects-title');
  await expectText(
    heading,
    /Projects\s*2/,
    'the Projects heading with its count',
  );
  // (The header's own team picker is a listbox button too; the page has none.)
  assert.equal(
    await page.locator("#main-content [aria-haspopup='listbox']").count(),
    0,
    'no team dropdown on the page',
  );

  // The list, in the server's order (by name).
  const cards = page.locator('li.pf-card');
  await eventually(
    'two Project cards',
    async () => (await cards.count()) === 2,
  );
  assert.deepEqual(await page.locator('.pf-card__name').allTextContents(), [
    'loyalty',
    'storefront',
  ]);
  const storefront = cards.filter({
    has: page.locator('.pf-card__name', { hasText: /^storefront$/ }),
  });
  // No per-repository BACKEND/FRONTEND chips on a card.
  assert.equal(
    await cards.locator('.pf-chip').count(),
    0,
    'no repository chips on the cards',
  );
  await expectText(
    storefront.locator('.pf-card__meta'),
    '2 repositories',
    'the storefront repository count',
  );
  await expectText(
    storefront.locator('.pf-card__meta'),
    '1 requirement',
    'the storefront requirement count',
  );
  const loyalty = cards.filter({
    has: page.locator('.pf-card__name', { hasText: /^loyalty$/ }),
  });
  await expectText(loyalty, '0 repositories', 'the empty loyalty Project');
  assert.equal(
    await page.locator('.pf-unfiled').count(),
    0,
    'every repository is filed',
  );

  // A Product owner's one create action: Create project, the New Project
  // dialog (name + description). No ⋯ menu: Developers add the repositories.
  assert.equal(
    await page.getByTestId('create-project-button').count(),
    1,
    'one Create project',
  );
  assert.equal(
    await page.getByRole('button', { name: 'New Project' }).count(),
    0,
    'no separate New Project button',
  );
  assert.equal(
    await page.getByRole('button', { name: 'More ways to create' }).count(),
    0,
    'no ⋯ menu for a Product owner',
  );
  assert.equal(
    await page.locator('a.pf-card__add').count(),
    0,
    'no Add repository on the cards',
  );
  await page.getByTestId('create-project-button').click();
  const newDialog = page.getByRole('dialog', { name: 'New Project' });
  await newDialog.getByPlaceholder('checkout').fill('payments');
  await newDialog.getByRole('button', { name: 'Create Project' }).click();
  await absent(newDialog, 'the New Project dialog');
  const create = onlyCall(
    backend.callsTo('POST', /^\/groups\/ws-checkout\/projects$/),
    'Project create',
  );
  assert.deepEqual(create.body, { name: 'payments' });
  await eventually(
    'the new Project in the list',
    async () => (await cards.count()) === 3,
  );
  await expectText(heading, /Projects\s*3/, 'the heading count after creating');

  // The card opens storefront as one product, on its frontend's page; Manage
  // (beside it, not inside it) opens the Project's detail.
  assert.equal(
    await storefront.locator('a.pf-card__open').getAttribute('href'),
    `/projects/${PROJECT_ID}`,
  );
  assert.equal(
    await loyalty.locator('a.pf-card__open').count(),
    0,
    'an empty Project has no page to open',
  );

  // Open storefront.
  await storefront.getByRole('button', { name: 'Manage storefront' }).click();
  await expectText(
    page.locator('.pf-detail__title'),
    'storefront',
    'the Project detail title',
  );
  // A Team lead's way in is PO Studio, where they accept the system and merge it.
  assert.equal(
    await page
      .getByRole('link', { name: 'Open PO Studio' })
      .getAttribute('href'),
    `/projects/${PROJECT_ID}#po`,
  );
  assert.equal(
    await page.getByRole('link', { name: 'Add repository' }).count(),
    0,
    'no Add repository for a Product owner',
  );

  // Requirements and QA belong to the Project now: no per-repository checklist attach.
  await visible(
    page.locator('section.rq-workspace'),
    'the Project QA workspace',
  );
  // System requirements are hidden for now (SHOWN_REQUIREMENT_KINDS): Features only.
  await visible(
    page.locator('section.rq-section[data-kind="functional"]'),
    'the Features section',
  );
  assert.equal(
    await page.locator('section.rq-section[data-kind="system"]').count(),
    0,
    'no System requirements section',
  );
  assert.equal(
    await page.locator('.pf-attach').count(),
    0,
    'no checklist attach',
  );
  assert.equal(
    backend.callsTo('PATCH', /^\/qa-checklists\/[^/]+\/projects$/).length,
    0,
    'never a repository share',
  );

  // Move: someone else moves orders-api first (409), then a real move.
  backend.moveConflictArmed = true;
  const foldersReads = () =>
    backend.callsTo('GET', /^\/groups\/ws-checkout\/project-folders$/).length;
  const readsBefore = foldersReads();
  await page
    .getByRole('button', { name: 'Move orders-api to another Project' })
    .click();
  const moveDialog = page.getByRole('dialog', { name: 'Move orders-api' });
  await moveDialog.getByRole('radio', { name: /loyalty/ }).check();
  await moveDialog.getByRole('button', { name: 'Move repository' }).click();
  await expectText(
    moveDialog.getByRole('alert'),
    'This repository was moved by someone else. Refresh and try again.',
    'the conflict message',
  );
  await eventually(
    'the explorer to refetch after the conflict',
    () => foldersReads() > readsBefore,
  );
  assert.equal(backend.expectedErrors.length, 1, 'exactly the armed 409');
  await moveDialog.getByRole('button', { name: 'Cancel' }).click();
  await absent(moveDialog, 'the move dialog');
  await eventually(
    'orders-api to have left storefront',
    async () =>
      (await page
        .getByRole('button', { name: 'Move orders-api to another Project' })
        .count()) === 0,
  );

  await page
    .getByRole('button', { name: 'Move storefront-web to another Project' })
    .click();
  const secondMove = page.getByRole('dialog', { name: 'Move storefront-web' });
  await secondMove.getByRole('radio', { name: /loyalty/ }).check();
  await secondMove.getByRole('button', { name: 'Move repository' }).click();
  await absent(secondMove, 'the second move dialog');
  const move = backend.callsTo('POST', /^\/repositories\/repo-web\/move$/);
  assert.equal(move.length, 1);
  assert.deepEqual(move[0].body, { deliveryProjectId: LOYALTY_FOLDER });
  const notice = page.locator('.pf-notice');
  await expectText(
    notice,
    'Moved storefront-web to loyalty. storefront has no repositories now.',
    'the emptied-Project notice',
  );

  // Archive the emptied Project: it leaves the list.
  await notice.getByRole('button', { name: 'Archive storefront' }).click();
  await expectText(notice, 'Archived storefront.', 'the archive confirmation');
  onlyCall(
    backend.callsTo(
      'POST',
      new RegExp(`^/delivery-projects/${STOREFRONT_FOLDER}/archive$`),
    ),
    'Project archive',
  );
  await eventually(
    'storefront to leave the list',
    async () =>
      (await page.locator('.pf-card__name').allTextContents()).join(',') ===
      'loyalty,payments',
  );
  await expectText(
    loyalty.locator('.pf-card__meta'),
    '2 repositories',
    'loyalty now holds both repositories',
  );

  // loyalty's detail offers a Product owner no Add repository either.
  await loyalty.getByRole('button', { name: 'Manage loyalty' }).click();
  await expectText(
    page.locator('.pf-detail__title'),
    'loyalty',
    'the loyalty detail',
  );
  assert.equal(
    await page.getByRole('link', { name: 'Add repository' }).count(),
    0,
    'no Add repository in the detail',
  );

  // Typed in, the wizard says who creates repositories instead of offering it.
  await page.goto(`${baseUrl}/workflows?tab=setup&group=${WORKSPACE.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await visible(
    page.getByText('Developers create repositories inside a Project.'),
    'the Product owner note in the wizard',
  );
  assert.equal(
    await page.locator('#project-type-select').count(),
    0,
    'no wizard for a Product owner',
  );
  assert.equal(
    backend.callsTo('POST', /^\/projects$/).length,
    0,
    'nothing was created',
  );
}

/**
 * (j) Developer: no Create project; Add repository on a Project's card and in
 * its detail opens the wizard filed in that Project; a bare wizard link asks
 * which of the team's Projects the repository belongs to.
 */
async function developerAddsRepositoryToProject({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'member');
  const cards = page.locator('li.pf-card');
  await eventually(
    'two Project cards',
    async () => (await cards.count()) === 2,
  );
  await neverShown(
    backend,
    page.getByTestId('create-project-button'),
    'Create project for a Developer',
  );
  assert.equal(
    await page.getByRole('button', { name: 'More ways to create' }).count(),
    0,
    'no ⋯ menu for a Developer',
  );

  // Add repository rides beside Manage on every card, filed in that Project.
  const storefront = cards.filter({
    has: page.locator('.pf-card__name', { hasText: /^storefront$/ }),
  });
  const add = storefront.getByRole('link', {
    name: 'Add repository to storefront',
  });
  assert.equal(
    await add.getAttribute('href'),
    `/workflows?tab=setup&group=${WORKSPACE.id}&project=${STOREFRONT_FOLDER}`,
  );
  assert.equal(
    await storefront.locator('a.pf-card__open a').count(),
    0,
    'never nested inside the card link',
  );

  // ...and in the Project's detail.
  const loyalty = cards.filter({
    has: page.locator('.pf-card__name', { hasText: /^loyalty$/ }),
  });
  await loyalty.getByRole('button', { name: 'Manage loyalty' }).click();
  await expectText(
    page.locator('.pf-detail__title'),
    'loyalty',
    'the loyalty detail',
  );
  await page
    .locator('.pf-detail__actions')
    .getByRole('link', { name: 'Add repository' })
    .click();
  await eventually('the wizard URL to carry ?group= and ?project=', () => {
    const url = new URL(page.url());
    return (
      url.pathname === '/workflows' &&
      url.searchParams.get('group') === WORKSPACE.id &&
      url.searchParams.get('project') === LOYALTY_FOLDER
    );
  });
  await expectText(
    page.getByTestId('setup-target-project'),
    `Project: ${WORKSPACE.name} / loyalty`,
    'the wizard Project line',
  );
  // Dev StrictMode runs the lookup effect twice; what matters is that it was resolved at all.
  assert.ok(
    backend.callsTo('GET', new RegExp(`^/delivery-projects/${LOYALTY_FOLDER}$`))
      .length > 0,
    'the wizard Project lookup',
  );

  // A bare wizard link: the Repository step asks for the Project, from the team's own.
  await page.goto(`${baseUrl}/workflows?tab=setup&group=${WORKSPACE.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('#project-type-select').selectOption('nextjs-app');
  await page.getByRole('button', { name: /^Continue/ }).click();
  const choice = page.getByTestId('setup-project-choice');
  await visible(choice, 'the Project select');
  await visible(
    page.getByText('Choose the Project this repository belongs to.'),
    'the Project prompt',
  );
  assert.equal(
    await page.locator('#project-name').count(),
    0,
    'no free Project name for a Developer',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Existing repository' }).count(),
    0,
    'no existing-repository onboarding for a Developer',
  );
  await eventually(
    'the team Projects in the select',
    async () =>
      (await choice.locator('option').allTextContents()).join(',') ===
      'Select a Project…,loyalty,storefront',
  );
  await page.locator('#repo-name').fill('loyalty-web');
  const next = page.getByRole('button', { name: /^Continue/ });
  assert.equal(await next.isDisabled(), true, 'Continue waits for the Project');
  await choice.selectOption({ label: 'loyalty' });
  assert.equal(
    await next.isDisabled(),
    false,
    'Continue once the Project is chosen',
  );
  assert.equal(
    backend.callsTo('POST', /^\/projects$/).length,
    0,
    'nothing was created',
  );
}

/**
 * (m) Developer, Features before repositories: on a Project with no Feature
 * Add repository is there but disabled with the reason, the wizard lists the
 * Project as "(no Features yet)" and blocks a link to it; once the Product
 * owner writes the first Feature, the same Developer goes ahead.
 */
async function developerWaitsForFirstFeature({
  page,
  backend,
  baseUrl,
}: JourneyContext) {
  const note = 'Waiting for your Product owner to add the first Feature.';
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'member');
  const cards = page.locator('li.pf-card');
  await eventually(
    'two Project cards',
    async () => (await cards.count()) === 2,
  );
  const loyalty = cards.filter({
    has: page.locator('.pf-card__name', { hasText: /^loyalty$/ }),
  });
  const storefront = cards.filter({
    has: page.locator('.pf-card__name', { hasText: /^storefront$/ }),
  });

  // storefront has a Feature: the link as before. loyalty has none: disabled, never a link.
  assert.equal(
    await storefront
      .getByRole('link', { name: 'Add repository to storefront' })
      .getAttribute('href'),
    `/workflows?tab=setup&group=${WORKSPACE.id}&project=${STOREFRONT_FOLDER}`,
  );
  const blocked = loyalty.getByRole('button', {
    name: 'Add repository to loyalty',
  });
  assert.equal(
    await blocked.getAttribute('aria-disabled'),
    'true',
    'the blocked control is aria-disabled',
  );
  assert.equal(
    await loyalty
      .getByRole('link', { name: 'Add repository to loyalty' })
      .count(),
    0,
    'no dead link',
  );
  await expectText(loyalty, note, 'the reason on the card');
  const describedBy = await blocked.getAttribute('aria-describedby');
  await expectText(
    page.locator(`[id="${describedBy}"]`),
    note,
    'the control is described by the reason',
  );
  // Playwright will not click an aria-disabled control; a user can, and nothing happens.
  await blocked.dispatchEvent('click');
  assert.equal(
    new URL(page.url()).searchParams.get('tab'),
    null,
    'a blocked control goes nowhere',
  );
  assert.equal(
    await page
      .getByText('Add a Feature so Developers can add repositories.')
      .count(),
    0,
    'no nudge for a Developer',
  );

  // The detail says the same.
  await loyalty.getByRole('button', { name: 'Manage loyalty' }).click();
  await expectText(
    page.locator('.pf-detail__title'),
    'loyalty',
    'the loyalty detail',
  );
  assert.equal(
    await page
      .locator('.pf-detail__actions')
      .getByRole('button', { name: 'Add repository' })
      .getAttribute('aria-disabled'),
    'true',
  );
  await expectText(
    page.locator('.pf-empty-folder'),
    note,
    'the empty repository list',
  );

  // The wizard: a bare link lists loyalty disabled; a ?project= link to it is blocked.
  await page.goto(`${baseUrl}/workflows?tab=setup&group=${WORKSPACE.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('#project-type-select').selectOption('nextjs-app');
  await page.getByRole('button', { name: /^Continue/ }).click();
  const choice = page.getByTestId('setup-project-choice');
  await eventually(
    'the team Projects in the select',
    async () =>
      (await choice.locator('option').allTextContents()).join(',') ===
      'Select a Project…,loyalty (no Features yet),storefront',
  );
  assert.equal(
    await choice
      .locator('option', { hasText: 'loyalty (no Features yet)' })
      .isDisabled(),
    true,
    'loyalty cannot be picked',
  );

  await page.goto(
    `${baseUrl}/workflows?tab=setup&group=${WORKSPACE.id}&project=${LOYALTY_FOLDER}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.locator('#project-type-select').selectOption('nextjs-app');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expectText(
    page.getByTestId('setup-project-blocker'),
    note,
    'the wizard blocker for a linked Project',
  );
  await page.locator('#repo-name').fill('loyalty-web');
  assert.equal(
    await page.getByRole('button', { name: /^Continue/ }).isDisabled(),
    true,
    'Create can never be reached',
  );

  // The Product owner writes loyalty's first Feature.
  backend.seedRequirement(LOYALTY_FOLDER, {
    kind: 'functional',
    name: 'Points on every order',
    items: [{ title: 'As a shopper, I earn points' }],
  });

  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  const unblocked = loyalty.getByRole('link', {
    name: 'Add repository to loyalty',
  });
  await visible(unblocked, 'Add repository on loyalty, now a link');
  assert.equal(await loyalty.getByText(note).count(), 0, 'the reason is gone');
  await unblocked.click();
  await eventually(
    'the wizard URL to carry ?project=',
    () => new URL(page.url()).searchParams.get('project') === LOYALTY_FOLDER,
  );
  await page.locator('#project-type-select').selectOption('nextjs-app');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.locator('#repo-name').fill('loyalty-web');
  assert.equal(
    await page.getByTestId('setup-project-blocker').count(),
    0,
    'no blocker once the Feature exists',
  );
  assert.equal(
    await page.getByRole('button', { name: /^Continue/ }).isDisabled(),
    false,
    'the Developer goes ahead',
  );
  assert.equal(
    backend.callsTo('POST', /^\/projects$/).length,
    0,
    'nothing was created',
  );
}

/** "Ready for production" in the run column's tab bar: the chip, its popover, and Merge to main beside it. */
function promotionCard(page: Page) {
  return {
    chip: page.locator('button.qa-promo-chip'),
    popover: page.locator('.qa-promo-pop'),
    merge: page.locator('button.qa-promo__merge'),
  };
}

/** The chip's accessible name: the full sentence, whatever the column's width shows. */
async function chipSays(chip: Locator, expected: string, description: string) {
  await eventually(
    `${description} to say ${expected}`,
    async () =>
      (await chip.count()) > 0 &&
      (await chip.getAttribute('aria-label')) === expected,
  );
}

/**
 * (f) Product owner, in PO Studio: QA signed the Project run off Approved, so
 * the gate waits on the Product owner's own check. Pass each item, the chip
 * turns Ready, Merge to main merges the repository and it reaches main.
 */
async function leadMergesToMain({ page, backend, baseUrl }: JourneyContext) {
  await openStudio(page, baseUrl, 'PO Studio');
  await expectRoleBadge(page, 'lead');
  const { chip, popover, merge } = promotionCard(page);
  await chipSays(chip, 'Not ready for production', 'the not-ready chip');
  assert.equal(
    await merge.isDisabled(),
    true,
    'Merge to main is disabled while not eligible',
  );
  await chip.click();
  await expectText(
    popover.locator('.qa-promo__reasons'),
    '2 items are waiting for the Product owner to pass them',
    'the server reason',
  );
  await page.keyboard.press('Escape');

  const check = page
    .locator('.qa-studio__run')
    .getByRole('region', { name: 'Your check' });
  await expectText(check, '0 of 2 passed by you', "the Product owner's check");

  // The Product owner passes each story QA passed.
  for (const story of FEATURE.stories)
    await check
      .getByRole('group', { name: `Your decision on ${story}` })
      .getByRole('button', { name: 'Pass' })
      .click();
  await expectText(check, '2 of 2 passed by you', 'every item passed');
  const decisions = backend.callsTo(
    'PATCH',
    /^\/delivery-projects\/[^/]+\/qa-runs\/[^/]+\/items\/[^/]+\/acceptance$/,
  );
  assert.equal(decisions.length, 2, 'one decision per item');
  assert.deepEqual(decisions[0].body, {
    decision: 'passed',
    expectedRowVersion: 1,
  });

  // The chip re-reads readiness on its own.
  await chipSays(chip, 'Ready for production', 'the ready chip');
  assert.equal(
    await merge.isDisabled(),
    false,
    'Merge to main is enabled once eligible',
  );

  // Merge to main, confirmed. A Project repository is named, not its branches.
  await merge.click();
  const confirm = page.getByRole('dialog', {
    name: 'Merge tone/storefront-web into main?',
  });
  await visible(confirm, 'the merge confirmation');
  assert.equal(
    backend.callsTo('POST', /\/qa\/promotion\/merge$/).length,
    0,
    'nothing merged before confirming',
  );
  await confirm.getByRole('button', { name: 'Merge to main' }).click();
  await absent(confirm, 'the merge confirmation');
  assert.deepEqual(
    onlyCall(backend.callsTo('POST', /\/qa\/promotion\/merge$/), 'merge').body,
    {},
    'the merge sends no body: the server picks the commit and the PR',
  );
  const outcome = page.locator('.qa-promo-outcome');
  await expectText(outcome, 'Merged into main', 'the merged outcome');
  // The repository is delivered: no second merge, and the button says why.
  await eventually('Merge to main disabled after the merge', () =>
    merge.isDisabled(),
  );
  const whyId = await merge.getAttribute('aria-describedby');
  assert.ok(whyId, 'the disabled button is described by its reason');
  await expectText(
    page.locator(`[id="${whyId}"]`),
    'uat @ 9f8e7d6 is already merged into main.',
    'the delivered repository',
  );
}

/** (g) Product owner: GitHub refuses the merge (required review), its words shown verbatim. */
async function leadMergeRefused({ page, backend, baseUrl }: JourneyContext) {
  await openStudio(page, baseUrl, 'PO Studio');
  const { chip, merge } = promotionCard(page);
  await chipSays(chip, 'Ready for production', 'the ready chip');
  await merge.click();
  const confirm = page.getByRole('dialog', {
    name: 'Merge tone/storefront-web into main?',
  });
  await confirm.getByRole('button', { name: 'Merge to main' }).click();
  await absent(confirm, 'the merge confirmation');
  const outcome = page.locator('.qa-studio__run .qa-promo-outcome');
  await expectText(
    outcome.locator('.qa-promo-outcome__title'),
    'GitHub refused the merge',
    'the refusal title',
  );
  assert.equal(
    await textOf(outcome.locator('blockquote')),
    GITHUB_REFUSAL,
    "GitHub's refusal, verbatim",
  );
  await expectText(
    outcome,
    'A reviewer must approve the pull request',
    'the unblock hint',
  );
  // A Project's view keeps to the Project: no pull request, no link out.
  await absent(outcome.locator('.qa-promo__pr'), 'the pull request');
  await absent(outcome.locator('a'), 'any link out of the refusal');
  onlyCall(backend.callsTo('POST', /\/qa\/promotion\/merge$/), 'merge request');
  assert.equal(
    await merge.isDisabled(),
    false,
    'still mergeable once GitHub allows it',
  );
}

/* A shared checklist whose run on uat's current head has every item passed; signed off Approved when `approved`. */
/* A run on main that QA already worked through: 1 passed, 2 and 3 returned. */
function seedReturnedRun(backend: QaMockBackend) {
  const checklist = backend.seedChecklist(
    {
      ...RELEASE_CHECKLIST,
      items: [...RELEASE_CHECKLIST.items, DEVELOPER_ITEM],
    },
    [PROJECT_ID],
  );
  const run = backend.seedRun(checklist, {
    id: PEOPLE.qa.id,
    login: PEOPLE.qa.login,
  });
  const byQa = { verifiedBy: { id: PEOPLE.qa.id, login: PEOPLE.qa.login } };
  backend.seedItem(run, 0, {
    ...byQa,
    status: 'passed',
    verifiedAt: ago(50 * MINUTE),
    updatedAt: Date.now() - 50 * MINUTE,
  });
  backend.seedItem(run, 1, {
    ...byQa,
    status: 'returned_to_dev',
    defectSeverity: 'major',
    notes: 'Coupon applied twice on a two-line cart.',
    reproductionSteps: '1. Add two mugs\n2. Apply SPRING10',
    verifiedAt: ago(40 * MINUTE),
    updatedAt: Date.now() - 40 * MINUTE,
  });
  backend.seedItem(run, 2, {
    ...byQa,
    status: 'returned_to_dev',
    defectSeverity: 'blocker',
    notes: 'No confirmation email for card orders.',
    reproductionSteps:
      '1. Pay with the saved card\n2. Wait five minutes\n3. Inbox is empty',
    verifiedAt: ago(30 * MINUTE),
    updatedAt: Date.now() - 30 * MINUTE,
  });
}

/**
 * (p) Admin: the project page's working tabs and Settings render on the
 * mocked backend with no failed request and no console error (the checks of
 * the old dashboard audit, on this file's contract-shaped mock).
 */
async function adminWalksProjectTabs({ page, baseUrl }: JourneyContext) {
  await openProjectTab(page, baseUrl, 'Pipeline');
  await expectRoleBadge(page, 'admin');
  await visible(page.getByText('No runs yet'), 'the empty pipeline');

  await openProjectTab(page, baseUrl, 'Hosting');
  await visible(
    page.getByRole('heading', { name: 'Host this repository' }),
    'the hosting setup',
  );
  await visible(
    page.getByRole('button', { name: 'Create target' }).first(),
    'a hosting target to create',
  );

  await openProjectTab(page, baseUrl, 'Audit');
  await visible(page.getByText('Requirement added'), 'an audit event');

  await page.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' });
  const account = page.locator('main');
  await expectText(account, `@${PEOPLE.admin.login}`, 'the account login');
  await expectText(account, PEOPLE.admin.email, 'the account email');
}

export const JOURNEYS: Journey[] = [
  {
    id: 'a',
    title:
      'Product owner: team checklists point to Projects; write a Feature with User stories on a Project',
    backend: () => new QaMockBackend('lead', 'enabled', 'enabled'),
    run: leadWritesProjectRequirements,
  },
  {
    id: 'k',
    title:
      'Developer: Project requirements read-only except Progress; Done reaches Ready for QA',
    backend: () => {
      const backend = new QaMockBackend('member', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: [
          { title: FEATURE.stories[0] },
          { title: FEATURE.stories[1], progress: 'in_progress' },
        ],
      });
      return backend;
    },
    run: developerMovesProgress,
  },
  {
    id: 'l',
    title:
      'QA Team: one Project run; Passed only after Done; Failed with a severity returns the story; no sign-off while it is failed',
    backend: () => {
      const backend = new QaMockBackend('qa', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: [
          { title: FEATURE.stories[0], progress: 'done' },
          { title: FEATURE.stories[1] },
        ],
      });
      return backend;
    },
    run: qaVerifiesProject,
  },
  {
    id: 'n',
    title:
      "QA Team: a twelve-item Project run scrolls inside QA Studio's column, also in full screen",
    backend: () => {
      const backend = new QaMockBackend('qa', 'enabled', 'enabled');
      seedLongProject(backend);
      backend.seedProjectRun(STOREFRONT_FOLDER, { verdict: 'APPROVED' });
      return backend;
    },
    run: qaLongProjectRunFits,
  },
  {
    id: 'o',
    title:
      'Team lead: PO Studio keeps Merge to main in view and scrolls a long acceptance inside the pane',
    backend: () => {
      const backend = new QaMockBackend('lead', 'enabled', 'enabled');
      seedLongProject(backend);
      backend.seedProjectRun(STOREFRONT_FOLDER, { verdict: 'APPROVED' });
      return backend;
    },
    run: leadAcceptanceFits,
  },
  {
    id: 'b',
    title:
      'QA Team: a test case holds its story until it passes; both stories pass; sign off Approved',
    backend: () => {
      const backend = new QaMockBackend('qa', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: FEATURE.stories.map((title) => ({ title, progress: 'done' })),
      });
      return backend;
    },
    run: qaVerifiesAndSignsOff,
  },
  {
    id: 'c',
    title:
      'Developer: Progress shows what QA failed; Done sends the fixed story back to QA; no QA Studio tab',
    backend: () => {
      const backend = new QaMockBackend('member', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: FEATURE.stories.map((title) => ({ title, progress: 'done' })),
      });
      const run = backend.seedProjectRun(STOREFRONT_FOLDER, {
        failFirst: true,
      });
      // The second story is still QA's to verify.
      run.items[1].status = 'pending';
      return backend;
    },
    run: developerRequestsRetest,
  },
  {
    id: 'd',
    title: 'QA Team: role badge, no workspace creation, read-only checklists',
    backend: () => {
      const backend = new QaMockBackend('qa');
      backend.seedChecklist(RELEASE_CHECKLIST, [PROJECT_ID]);
      return backend;
    },
    run: qaTeamCannotCreate,
  },
  {
    id: 'f',
    title:
      'Product owner: QA approved, not ready until the Product owner passes every item; then Merge to main delivers the repository',
    backend: () => {
      const backend = new QaMockBackend('lead', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: FEATURE.stories.map((title) => ({ title, progress: 'done' })),
      });
      backend.seedProjectRun(STOREFRONT_FOLDER, { verdict: 'APPROVED' });
      return backend;
    },
    run: leadMergesToMain,
  },
  {
    id: 'g',
    title:
      'Product owner: GitHub refuses the merge, its refusal shown verbatim',
    backend: () => {
      const backend = new QaMockBackend('lead', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: FEATURE.stories.map((title) => ({ title, progress: 'done' })),
      });
      backend.seedProjectRun(STOREFRONT_FOLDER, {
        verdict: 'APPROVED',
        accepted: true,
      });
      backend.mergeMode = 'refuse';
      return backend;
    },
    run: leadMergeRefused,
  },
  {
    id: 'e',
    title:
      'Capabilities without qaChecklists: no Checklists / QA Studio tab, no sidebar Checklists, /checklists says off',
    backend: () => {
      // A lead, so nothing is hidden by role: only the missing field can hide it.
      const backend = new QaMockBackend('lead', 'absent');
      seedReturnedRun(backend);
      return backend;
    },
    run: capabilityAbsentHidesQa,
  },
  {
    id: 'h',
    title:
      'Team lead: project explorer — Create project dialog, list, open, requirements and QA, move (409 + real), archive, no repository create',
    backend: () => {
      const backend = new QaMockBackend('lead', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'system',
        name: RELEASE_CHECKLIST.name,
        items: RELEASE_CHECKLIST.items,
      });
      return backend;
    },
    run: leadOrganisesProjects,
  },
  {
    id: 'j',
    title:
      'Developer: no Create project; Add repository on a card and in the detail; the wizard asks for the Project',
    backend: () => new QaMockBackend('member'),
    run: developerAddsRepositoryToProject,
  },
  {
    id: 'm',
    title:
      'Developer: Features before repositories — Add repository disabled with the reason until the first Feature, then allowed',
    backend: () => {
      const backend = new QaMockBackend('member', 'enabled', 'enabled');
      backend.seedRequirement(STOREFRONT_FOLDER, {
        kind: 'functional',
        name: FEATURE.name,
        items: [{ title: FEATURE.stories[0] }],
      });
      return backend;
    },
    run: developerWaitsForFirstFeature,
  },
  {
    id: 'i',
    title:
      'Team lead: a Project opens on its frontend as one product (tabs in the title row, no switch, no Manage project), frontend-only chips',
    backend: () => new QaMockBackend('lead'),
    run: leadSwitchesRepositories,
  },
  {
    id: 'p',
    title:
      "Admin: the project's Pipeline, Hosting and Audit tabs and Settings render without a browser error",
    backend: () => new QaMockBackend('admin', 'enabled', 'enabled'),
    run: adminWalksProjectTabs,
  },
];

/* What GET /deployment-providers says each provider can do
 * (legacy-provider.shared.ts and onprem-compose.provider.ts). */
const HOSTED_PROVIDER_CAPABILITIES = {
  envVars: true,
  logs: true,
  deployHistory: true,
  teardown: true,
  managedMode: true,
  liveStatus: true,
  connectivity: 'direct',
  enumerable: true,
  credentialCustody: 'platform',
  envProvisioning: true,
} as const;

const ONPREM_PROVIDER_CAPABILITIES = {
  envVars: false,
  logs: false,
  deployHistory: false,
  teardown: false,
  managedMode: false,
  liveStatus: false,
  connectivity: 'indirect',
  enumerable: false,
  credentialCustody: 'external',
  envProvisioning: false,
  previewDeployments: false,
} as const;

/* ── Runner ──────────────────────────────────────────────────────────────── */

const PREVIEW_HTML =
  '<!doctype html><title>Storefront</title><h1>Checkout</h1>';

/** A failed step, with what was on screen and what the mock refused. */
async function withFailureContext(
  error: unknown,
  page: Page,
  backend: QaMockBackend,
): Promise<Error> {
  const lines = [error instanceof Error ? error.message : String(error)];
  // Where in the journey it stopped: the helper and the journey step that called it.
  const frames = (error instanceof Error ? (error.stack ?? '') : '')
    .split('\n')
    .filter((line) => line.includes('qa-journeys'))
    .slice(0, 3);
  for (const frame of frames)
    lines.push(`at: ${frame.trim().replace(/^at /, '')}`);
  if (error instanceof Error && error.cause instanceof Error)
    lines.push(`cause: ${error.cause.message.split('\n')[0]}`);
  const screen = await page
    .locator('body')
    .innerText({ timeout: 2_000 })
    .catch(() => '(page unavailable)');
  lines.push(`url: ${page.url()}`, `visible text:\n${screen.slice(0, 1500)}`);
  if (backend.refusals.length > 0)
    lines.push(`mock refusals:\n${backend.refusals.join('\n')}`);
  return new Error(lines.join('\n'));
}

/**
 * Runs one journey on the test's own page and context: its mock backend
 * answers every /api/v1 call, and any page error, console error or refused
 * call fails it.
 */
export async function runJourney(
  {
    page,
    context,
    baseURL,
  }: { page: Page; context: BrowserContext; baseURL: string },
  journey: Journey,
) {
  const backend = journey.backend();
  const problems: string[] = [];
  if (journey.permissions)
    await context.grantPermissions(journey.permissions, { origin: baseURL });
  // Context-wide, so the print page opened by Download PDF is mocked too.
  await context.route('**/api/v1/**', (route) => backend.handle(route));
  for (const origin of [PREVIEW_ORIGIN, MAIN_PREVIEW_ORIGIN]) {
    await context.route(`${origin}/**`, (route) =>
      text(route, 200, PREVIEW_HTML, 'text/html'),
    );
  }
  const watch = (watched: Page) => {
    watched.on('pageerror', (error) =>
      problems.push(`page error: ${error.message}`),
    );
    watched.on('console', (message) => {
      if (message.type() === 'error')
        problems.push(`console error: ${message.text()}`);
    });
  };
  watch(page);
  context.on('page', watch);
  try {
    await journey.run({ page, context, backend, baseUrl: baseURL });
  } catch (error) {
    throw await withFailureContext(error, page, backend);
  }
  // The browser logs every 4xx as a console error; one per reply the journey
  // provoked on purpose is expected, anything beyond that still fails.
  for (const expected of backend.expectedErrors) {
    const status = expected.split(' ')[0];
    const index = problems.findIndex((line) =>
      line.includes(`status of ${status}`),
    );
    if (index >= 0) problems.splice(index, 1);
  }
  problems.push(
    ...backend.refusals.map((refusal) => `unexpected API reply: ${refusal}`),
  );
  if (problems.length > 0) throw new Error(problems.join('\n'));
}
