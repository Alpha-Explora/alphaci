import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import type { Browser, BrowserContext, Locator, Page, Route } from 'playwright';

import type {
  AppRole,
  AuthMeResponse,
  CapabilitiesResponse,
  ProjectOptionsResponse,
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
  ProvisionedProject,
  WorkflowFileMetadata,
} from '../../src/shared/api/contracts';
import type { DeliveryProject, GroupMember, GroupSummary } from '../../src/features/groups/data/hierarchy-contracts';
import type {
  ChecklistProjectsPatch,
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
import { json, text } from './support';

/* QA journeys — the QA checklist feature driven end to end, one persona at a
 * time, against a stateful mock of the backend.
 *
 * Run by playwright-e2e.ts when E2E_QA_JOURNEYS=1. Every journey opens its own
 * browser context with its own QaMockBackend, so a write in one journey never
 * leaks into the next.
 *
 * The mock mirrors the backend contract, not just its shapes:
 *   - response bodies are typed with the frontend's own wire types (the same
 *     ones the app parses), and
 *   - the rules the UI depends on are ported from the backend (the
 *     alphaci-golden-copy-be repo, src/modules/projects/), with its error
 *     messages: domain/qa-run-access.rules.ts (who may do what),
 *     application/qa-runs/qa-runs.service.ts (severity required, verdict
 *     rules, re-test only from returned_to_dev, rowVersion conflicts),
 *     application/qa-runs/qa-automation-matching.ts (how an item gets its
 *     automated result), qa-report.mapper.ts (the report JSON) and
 *     application/qa-checklists/qa-checklists.service.ts (who manages
 *     checklists, what sharing accepts), and the project-folder endpoints
 *     (GET /groups/:id/project-folders, 404 for a non-member; POST
 *     /groups/:id/projects; POST /repositories/:id/move, 404 target missing
 *     or in another team, 400 archived, 409 moved concurrently; PATCH
 *     /qa-checklists/:id/projects add/remove).
 * So a UI change that starts sending something the real server would refuse
 * fails here as a 4xx instead of passing against a permissive fake.
 *
 * A journey fails on any mock reply of 400 or more, any /api/v1 call nothing
 * mocks (a 404), any uncaught page error and any console error.
 *
 * Local run (Windows needs webpack; Next 16 dev refuses its own dev resources
 * to a 127.0.0.1 origin, so browse via localhost):
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:4862/api/v1 npx next dev --webpack --port 4862
 *   E2E_QA_JOURNEYS=1 E2E_BASE_URL=http://localhost:4862 npm run test:e2e
 * E2E_QA_ONLY=b,c runs a subset; E2E_BROWSER_EXECUTABLE_PATH points at a local
 * Chromium; E2E_QA_ARTIFACTS=<dir> saves a screenshot of a failed journey. */

/* ── People, places and time ─────────────────────────────────────────────── */

const MINUTE = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

interface Person extends QaActor {
  name: string;
  email: string;
}

const PEOPLE: Record<AppRole, Person> = {
  admin: { id: 'user-admin', login: 'ria-admin', name: 'Ria Admin', email: 'ria@example.test' },
  lead: { id: 'user-lead', login: 'tone-lead', name: 'Tone Lead', email: 'tone@example.test' },
  qa: { id: 'user-qa', login: 'ana-qa', name: 'Ana QA', email: 'ana@example.test' },
  member: { id: 'user-dev', login: 'miguel-dev', name: 'Miguel Dev', email: 'miguel@example.test' },
};

const ROLE_BADGES: Record<AppRole, string> = {
  admin: 'Admin',
  lead: 'Team lead',
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
const PROMOTION_PR = { number: 42, url: 'https://github.com/tone/storefront-web/pull/42' };
const MERGE_SHA = '5a5b5c5d5e5f60718293a4b5c6d7e8f901234567';
/** GitHub's own refusal text for a protected main: the UI must show it verbatim. */
const GITHUB_REFUSAL = 'At least 1 approving review is required by reviewers with write access.';
const VERIFY_RUN_URL = 'https://github.com/tone/storefront-web/actions/runs/11873450921';
const QUALITY_RUN_URL = 'https://github.com/tone/storefront-web/actions/runs/11873450377';

type TeamProject = ProvisionedProject & { workflowFiles: WorkflowFileMetadata[]; workspaceId: string };

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
    { stage: 'access', name: 'ALPHACI Access Gate', path: '.github/workflows/00-alphaci-access.yml', gated: true },
    { stage: 'quality', name: 'ALPHACI Quality', path: '.github/workflows/10-alphaci-quality.yml', gated: true },
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
    { id: LOYALTY_FOLDER, name: 'loyalty', createdAt: ago(20 * 24 * 60 * MINUTE), archived: false, repositories: [] },
    {
      id: STOREFRONT_FOLDER,
      name: 'storefront',
      createdAt: ago(30 * 24 * 60 * MINUTE),
      archived: false,
      repositories: [
        { id: 'repo-web', name: 'storefront-web', repoFullName: 'tone/storefront-web', projectId: PROJECT_ID, role: 'frontend', archived: false },
        { id: 'repo-api', name: 'orders-api', repoFullName: 'tone/orders-api', projectId: 'project-2', role: 'backend', archived: false },
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
const VERIFY_FAILURE_NAME = 'e2e/checkout.spec.ts > checkout > pays with a saved card';
const VERIFY_FAILURE_MESSAGE = 'Expected "Order placed" but the page said "Card declined".';

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
        failures: [{ name: VERIFY_FAILURE_NAME, message: VERIFY_FAILURE_MESSAGE }],
        failuresTruncated: false,
      },
    },
    quality: {
      stage: 'quality',
      status: 'success',
      runId: 11873450377,
      runUrl: QUALITY_RUN_URL,
      reportedAt: ago(15 * MINUTE),
      tests: { total: 142, passed: 142, failed: 0, failures: [], failuresTruncated: false },
    },
  };
}

/* ── Backend rules, ported ───────────────────────────────────────────────── */

/* qa-run-access.rules.ts, verbatim in behaviour. */
function personaAllowsRole(persona: ChecklistTargetPersona, role: AppRole): boolean {
  if (role === 'admin' || role === 'lead') return true;
  if (persona === 'all') return true;
  if (persona === 'developer') return role === 'member';
  return role === 'qa';
}
const canCreateRun = (role: AppRole) => role === 'qa' || role === 'lead' || role === 'admin';
const canSetReturnedToDev = canCreateRun;
const canSignOff = canCreateRun;
const canDispatchAutomation = canCreateRun;
const canRequestRetest = (role: AppRole) => role === 'member' || role === 'lead' || role === 'admin';
const canReopenRun = (role: AppRole) => role === 'lead' || role === 'admin';
/* Merge to main: Team leads and Admins only. */
const canMergePromotion = (role: AppRole) => role === 'lead' || role === 'admin';
/* QaAccessService.canManage: global project creators (admin, lead). */
const canManageChecklists = (role: AppRole) => role === 'admin' || role === 'lead';

const OPEN_DEFECT_STATUSES: ReadonlyArray<QaRunItemStatus> = ['failed', 'blocked', 'returned_to_dev'];

/* qa-automation-matching.ts. */
function itemSpecFile(testIdentifier: string): string {
  const cuts = [testIdentifier.indexOf(' › '), testIdentifier.indexOf(' > ')].filter((i) => i >= 0);
  return (cuts.length === 0 ? testIdentifier : testIdentifier.slice(0, Math.min(...cuts))).trim();
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
function stageLevel(status: QaStageAutomationWire['status']): 'passed' | 'failed' | 'unknown' {
  if (status === 'running' || status === 'cancelled') return 'unknown';
  return status === 'success' ? 'passed' : 'failed';
}
function matchAutomated(
  item: { verificationType: ChecklistVerificationType; testIdentifier: string | null },
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
    return { ...base, ...none, status: stageLevel(report.status), scope: 'stage' };
  }
  if (!item.testIdentifier) {
    return { ...base, ...none, status: tests.failed === 0 ? 'passed' : 'failed', scope: 'stage' };
  }
  const itemFile = normalizeSpecPath(itemSpecFile(item.testIdentifier));
  const match = (tests.failures ?? []).find((failure) =>
    specFilesMatch(normalizeSpecPath(failureSpecFile(failure.name ?? '')), itemFile),
  );
  if (match) {
    return { ...base, status: 'failed', scope: 'spec', matchedSpec: itemFile, failure: { name: match.name, message: match.message } };
  }
  if (tests.failed === 0) return { ...base, ...none, status: 'passed', scope: 'suite' };
  if (!tests.failuresTruncated) return { ...base, status: 'passed', scope: 'spec', matchedSpec: itemFile, failure: null };
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

const REASONS: Record<number, string> = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' };

/** A Nest HttpException with a string message, as the client receives it. */
function nestError(status: number, message: string): HttpError {
  return new HttpError(status, { statusCode: status, message, error: REASONS[status] });
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
  private seq = 0;
  private readonly routes: Array<[string, RegExp, Handler]>;

  constructor(
    readonly role: AppRole,
    private readonly qaCapability: 'enabled' | 'absent' = 'enabled',
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
    return this.calls.filter((call) => call.method === method && pathPattern.test(call.path));
  }

  /* ── Seeding ── */

  seedChecklist(input: { name: string; description: string | null; items: QaChecklistItemInput[] }, sharedProjectIds: string[]): QaChecklist {
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
  private toChecklistItems(items: QaChecklistItemInput[]): QaChecklist['items'] {
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
    const apiRequest: ApiRequest = { method: request.method(), path, query: url.searchParams, body };
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
    if (reply.contentType) return text(route, status, String(reply.body), reply.contentType);
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
        if (error instanceof HttpError) return { status: error.status, body: error.body };
        throw error;
      }
    }
    return { status: 404, body: `No E2E fixture for ${request.method} ${request.path}`, contentType: 'text/plain' };
  }

  private buildRoutes(): Array<[string, RegExp, Handler]> {
    const P = '([^/]+)';
    return [
      ['GET', /^\/auth\/me$/, () => ({ body: this.authMe() })],
      ['GET', /^\/capabilities$/, () => ({ body: this.capabilities() })],
      ['GET', /^\/workspaces\/me$/, () => ({ body: this.workspacesMe() })],
      ['GET', /^\/groups$/, () => ({ body: [this.group()] })],
      // The Teams page is the header team's members.
      ['GET', new RegExp(`^/groups/${P}/members$`), (m) => ({ body: this.groupMembers(m[1]) })],
      ['GET', new RegExp(`^/groups/${P}/activity$`), (m) => this.groupActivity(m[1])],
      ['GET', /^\/notifications$/, () => ({ body: { enabled: true, unreadCount: 0, items: [] } satisfies NotificationsResponse })],
      // The project page reads only enforcedOrg (to label repositories outside it "External").
      ['GET', /^\/catalog\/project-options$/, () => ({ body: this.projectOptions() })],
      ['GET', /^\/projects$/, (_m, req) => ({ body: { items: this.projectsFor(req.query.get('workspaceId')) } })],
      ['GET', new RegExp(`^/projects/${P}/overview$`), (m) => ({ body: this.overview(m[1]) })],
      ['GET', new RegExp(`^/projects/${P}/previews$`), (m) => ({ body: this.previews(m[1]) })],
      // Checklists
      ['GET', new RegExp(`^/workspaces/${P}/qa-checklists$`), (m, req) => ({ body: this.listWorkspaceChecklists(m[1], req.query) })],
      ['POST', new RegExp(`^/workspaces/${P}/qa-checklists$`), (m, req) => ({ status: 201, body: this.createChecklist(m[1], req.body) })],
      ['GET', new RegExp(`^/qa-checklists/${P}$`), (m) => ({ body: this.requireChecklist(m[1]) })],
      ['PUT', new RegExp(`^/qa-checklists/${P}/projects$`), (m, req) => ({ body: this.shareChecklist(m[1], req.body) })],
      ['GET', new RegExp(`^/projects/${P}/qa-checklists$`), (m) => ({ body: this.listProjectChecklists(m[1]) })],
      // Runs
      ['GET', new RegExp(`^/projects/${P}/qa-runs/current$`), (_m, req) => ({ body: this.currentRun(req.query) })],
      ['POST', new RegExp(`^/projects/${P}/qa-runs$`), (_m, req) => this.createRun(req.body)],
      ['GET', new RegExp(`^/projects/${P}/qa-runs/${P}$`), (m) => ({ body: this.assembleRun(this.requireRun(m[2])) })],
      ['PATCH', new RegExp(`^/projects/${P}/qa-runs/${P}/items/${P}$`), (m, req) => ({ body: this.updateItem(m[2], m[3], req.body) })],
      ['POST', new RegExp(`^/projects/${P}/qa-runs/${P}/items/${P}/request-retest$`), (m, req) => ({ body: this.requestRetest(m[2], m[3], req.body) })],
      ['POST', new RegExp(`^/projects/${P}/qa-runs/${P}/signoff$`), (m, req) => ({ body: this.signoff(m[2], req.body) })],
      ['GET', new RegExp(`^/projects/${P}/qa-runs/${P}/report$`), (m, req) => this.report(m[2], req.query.get('format'))],
      ['POST', new RegExp(`^/projects/${P}/qa-runs/${P}/automation/dispatch$`), (m) => ({ status: 202, body: this.dispatchAutomation(m[2]) })],
      ['GET', new RegExp(`^/projects/${P}/qa-returned-items$`), () => ({ body: { items: this.returnedItems() } satisfies QaReturnedItemsResponse })],
      // Project folders (the Teams project explorer)
      ['GET', new RegExp(`^/groups/${P}/project-folders$`), (m) => ({ body: this.projectFolders(m[1]) })],
      // The project page's Project identity and repository switch.
      ['GET', new RegExp(`^/projects/${P}/folder$`), (m) => ({ body: this.projectFolder(m[1]) })],
      ['POST', new RegExp(`^/groups/${P}/projects$`), (m, req) => ({ status: 201, body: this.createFolder(m[1], req.body) })],
      ['POST', new RegExp(`^/repositories/${P}/move$`), (m, req) => this.moveRepository(m[1], req.body)],
      ['GET', new RegExp(`^/delivery-projects/${P}$`), (m) => ({ body: this.deliveryProject(this.requireFolder(m[1])) })],
      ['POST', new RegExp(`^/delivery-projects/${P}/archive$`), (m) => ({ body: this.archiveFolder(m[1]) })],
      ['PATCH', new RegExp(`^/qa-checklists/${P}/projects$`), (m, req) => ({ body: this.patchChecklistShares(m[1], req.body) })],
      // The Create Project wizard (/workflows): read-only fixtures
      ['GET', /^\/catalog\/categories$/, () => ({ body: { categories: [] } })],
      ['GET', /^\/catalog\/templates$/, () => ({ body: { templates: [] } })],
      ['GET', /^\/workflows\/history$/, () => ({ body: { items: [] } })],
      ['GET', /^\/usage\/me$/, () => ({ body: { enabled: false, items: [] } })],
      ['GET', /^\/github\/app\/install-url$/, () => ({ body: { installUrl: 'https://github.com/apps/alphaci/installations/new', appSlug: 'alphaci' } })],
      ['GET', /^\/github\/installations\/accounts$/, () => ({ body: { accounts: [] } })],
      ['GET', /^\/github\/installations\/repos$/, () => ({ body: { repos: [] } })],
      ['GET', /^\/provider-connections$/, () => ({ body: [] })],
      ['GET', new RegExp(`^/projects/${P}/qa-my-items$`), () => ({ body: this.myItems() })],
      // Promotion
      ['GET', new RegExp(`^/projects/${P}/qa/promotion$`), (m) => ({ body: this.promotion(m[1]) })],
      ['POST', new RegExp(`^/projects/${P}/qa/promotion/merge$`), (m) => ({ body: this.mergePromotion(m[1]) })],
    ];
  }

  /* ── Session, capabilities, workspace ── */

  private authMe(): AuthMeResponse {
    const person = PEOPLE[this.role];
    return {
      authenticated: true,
      user: { id: person.id, login: person.login, name: person.name, email: person.email, onboardingCompleted: true },
      subscription: { plan: 'pro', status: 'active', provider: 'manual', updatedAt: ago(90 * 24 * 60 * MINUTE) },
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
      clientComposition: { enabled: false, clientId: null, displayName: null, edition: null, disabledCapabilities: [] },
      envProvisioning: { enabled: true, providers: ['render', 'vercel'], environments: ['test', 'uat', 'production'], modes: ['flowci_managed'] },
      projectSyncSnapshots: { enabled: true, liveGithubEnabled: false, liveProvidersEnabled: false, mode: 'local_snapshot' },
      workflowSettingsPreview: { enabled: true },
      workflowUpdatePr: { enabled: true },
      qaChecklists: { enabled: true },
      projectTargetManagement: { enabled: true },
      ciRunTracking: { enabled: true, liveGithubEnabled: false, mode: 'local_mock' },
      deploymentHistory: { enabled: true, liveProvidersEnabled: true, mode: 'local_mock' },
      previewDeployments: { enabled: true, providers: ['vercel'] },
      driftDetection: { enabled: true, liveProviderChecksEnabled: false, mode: 'local_snapshot' },
      driftRepair: { enabled: true, liveRepairEnabled: false, mode: 'local_safe' },
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
      items: [{ id: WORKSPACE.id, name: WORKSPACE.name, kind: 'team', role: this.role === 'lead' || this.role === 'admin' ? 'admin' : 'member' }],
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
      memberStatus: 'active',
      memberCount: 3,
      systemCount: 0,
      createdAt: ago(120 * 24 * 60 * MINUTE),
      archivedAt: null,
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

  private projectOptions(): ProjectOptionsResponse {
    return { repoShapes: [], projectTypes: [], recipes: [], nodeVersions: [], enforcedOrg: 'tone' };
  }

  private projectsFor(workspaceId: string | null): ProvisionedProject[] {
    return PROJECTS.filter((project) => !workspaceId || project.workspaceId === workspaceId);
  }

  private requireProject(projectId: string): TeamProject {
    const project = PROJECTS.find((entry) => entry.id === projectId);
    if (!project) throw nestError(404, 'Project not found');
    return project;
  }

  private overview(projectId: string): ProjectOverviewResponse {
    const project = this.requireProject(projectId);
    return {
      project: { ...project, createdAt: ago(60 * 24 * 60 * MINUTE), updatedAt: ago(24 * 60 * MINUTE) },
      workflow: { path: project.workflowPath, files: project.workflowFiles, stageCount: project.workflowFiles.length, history: [] },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: { status: 'active', tokenPresent: true, tokenPrefix: 'aci_live', createdAt: ago(60 * 24 * 60 * MINUTE), updatedAt: ago(60 * 24 * 60 * MINUTE), revokedAt: null },
      health: { summary: 'ok', checks: [] },
      syncSnapshot: { enabled: false, mode: 'local_snapshot', latest: null },
      capabilities: { envProvisioning: true, workflowSettings: false, syncSnapshots: false, ciRunTracking: false, deploymentHistory: false, driftDetection: false },
      hierarchyRepositoryId: null,
    };
  }

  private previews(projectId: string): ProjectPreviewsResponse {
    const project = this.requireProject(projectId);
    if (project.id !== PROJECT_ID) return { enabled: true, liveProvidersEnabled: true, providerError: null, branches: [] };
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
      return { status: 403, body: { statusCode: 403, message: 'Insufficient group role', error: 'Forbidden' }, expected: this.activityForbiddenArmed };
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
      status: folder.archived ? 'archived' : 'active',
      repositoryCount: folder.repositories.filter((repo) => !repo.archived).length,
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
    const filed = new Set(live.flatMap((folder) => folder.repositories.map((repo) => repo.projectId)));
    return {
      groupId,
      canManage: this.isLead(),
      folders: live.map((folder) => ({
        deliveryProjectId: folder.id,
        systemId: SYSTEM_ID,
        name: folder.name,
        createdAt: folder.createdAt,
        repositories: folder.repositories
          .filter((repo) => !repo.archived)
          .map((repo) => ({
            repositoryId: repo.id,
            name: repo.name,
            repoFullName: repo.repoFullName,
            status: 'active',
            project: repo.projectId ? { id: repo.projectId, role: repo.role, status: 'provisioned', repoShape: 'multi-repo' } : null,
          })),
      })),
      unfiled: PROJECTS.filter((project) => !filed.has(project.id)).map((project) => ({
        id: project.id,
        name: project.serviceName,
        repoFullName: project.repoFullName,
        role: 'app' as const,
        status: 'provisioned',
        repoShape: 'standalone',
      })),
    };
  }

  /** GET /projects/:id/folder — the Project a repository is in, frontend first. */
  private projectFolder(projectId: string): ProjectFolderWire {
    const project = PROJECTS.find((entry) => entry.id === projectId);
    if (!project) throw nestError(404, 'Project not found');
    const folder = this.folders.find(
      (entry) => !entry.archived && entry.repositories.some((repo) => !repo.archived && repo.projectId === projectId),
    );
    if (!folder) {
      // Unfiled: a Project of one, which the page shows exactly as before.
      return {
        deliveryProjectId: null,
        groupId: WORKSPACE.id,
        name: project.serviceName,
        repositories: [{ projectId, name: project.serviceName, repoFullName: project.repoFullName, role: 'app', status: 'provisioned' }],
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

  private createFolder(groupId: string, body: Record<string, unknown>): DeliveryProject {
    if (groupId !== WORKSPACE.id) throw nestError(404, 'Group not found');
    if (!this.isLead()) throw nestError(403, 'Only a team lead can create projects');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 200) throw nestError(400, 'name must be between 1 and 200 characters');
    const folder: FolderRow = { id: this.nextId('folder'), name, createdAt: new Date().toISOString(), archived: false, repositories: [] };
    this.folders.push(folder);
    return this.deliveryProject(folder);
  }

  private moveRepository(repositoryId: string, body: Record<string, unknown>): ApiReply {
    if (!this.isLead()) throw nestError(403, 'Only a team lead can move repositories');
    const source = this.folders.find((folder) => folder.repositories.some((repo) => repo.id === repositoryId));
    const repo = source?.repositories.find((entry) => entry.id === repositoryId);
    if (!source || !repo) throw nestError(404, 'Repository not found');
    const target = this.requireFolder(String(body.deliveryProjectId ?? ''));
    if (repo.archived || target.archived) throw nestError(400, 'Archived repositories and projects cannot be moved');
    if (this.moveConflictArmed) {
      this.moveConflictArmed = false;
      // Someone else got there first: the repository now sits in the target.
      source.repositories.splice(source.repositories.indexOf(repo), 1);
      target.repositories.push(repo);
      return { status: 409, body: { statusCode: 409, message: 'Repository was moved concurrently', error: 'Conflict' }, expected: true };
    }
    if (source === target) {
      return { body: { repository: { id: repo.id }, moved: false, sourceDeliveryProjectId: source.id, sourceDeliveryProjectEmpty: false } };
    }
    source.repositories.splice(source.repositories.indexOf(repo), 1);
    target.repositories.push(repo);
    const reply: MoveRepositoryResponseWire = {
      repository: { id: repo.id, deliveryProjectId: target.id },
      moved: true,
      sourceDeliveryProjectId: source.id,
      sourceDeliveryProjectEmpty: source.repositories.filter((entry) => !entry.archived).length === 0,
    };
    return { body: reply };
  }

  private archiveFolder(folderId: string): DeliveryProject {
    if (!this.isLead()) throw nestError(403, 'Only a team lead can archive projects');
    const folder = this.requireFolder(folderId);
    folder.archived = true;
    return this.deliveryProject(folder);
  }

  private patchChecklistShares(checklistId: string, body: Record<string, unknown>): QaChecklist {
    const checklist = this.requireChecklist(checklistId);
    this.assertManage();
    if (checklist.archivedAt) throw nestError(409, 'Checklist is archived');
    const patch = body as ChecklistProjectsPatch;
    const add = [...new Set(patch.add ?? [])];
    const remove = new Set(patch.remove ?? []);
    const rejected = [...add, ...remove].filter((id) => !PROJECTS.some((p) => p.id === id && p.workspaceId === checklist.workspaceId));
    if (rejected.length > 0) {
      throw nestError(400, `These project ids are not in this checklist's workspace: ${rejected.join(', ')}`);
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
      throw nestError(403, 'Only a workspace lead or admin can manage QA checklists');
    }
  }

  private listWorkspaceChecklists(workspaceId: string, query: URLSearchParams): QaChecklistListResponse {
    if (workspaceId !== WORKSPACE.id) throw nestError(404, 'Checklist not found');
    const includeArchived = query.get('includeArchived') === 'true';
    return {
      items: this.checklists.filter((entry) => includeArchived || entry.archivedAt === null),
      canManage: canManageChecklists(this.role),
    };
  }

  private createChecklist(workspaceId: string, body: Record<string, unknown>): QaChecklist {
    if (workspaceId !== WORKSPACE.id) throw nestError(404, 'Checklist not found');
    this.assertManage();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw nestError(400, 'name must not be blank');
    if (this.checklists.some((entry) => entry.archivedAt === null && entry.name === name)) {
      throw nestError(409, `A checklist named "${name}" already exists in this workspace.`);
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

  private shareChecklist(checklistId: string, body: Record<string, unknown>): QaChecklist {
    const checklist = this.requireChecklist(checklistId);
    this.assertManage();
    if (checklist.archivedAt) throw nestError(409, 'Checklist is archived');
    const requested = [...new Set((body.projectIds as string[] | undefined) ?? [])];
    const rejected = requested.filter((id) => !PROJECTS.some((p) => p.id === id && p.workspaceId === checklist.workspaceId));
    if (rejected.length > 0) {
      throw nestError(400, `These project ids are not in this checklist's workspace: ${rejected.join(', ')}`);
    }
    // Sharing does not bump the checklist version: only content edits do.
    checklist.sharedProjectIds = requested;
    return checklist;
  }

  private listProjectChecklists(projectId: string): QaChecklistListResponse {
    const project = this.requireProject(projectId);
    return {
      items: this.checklists
        .filter((entry) => entry.archivedAt === null && entry.sharedProjectIds.includes(project.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      canManage: Boolean(project.workspaceId) && canManageChecklists(this.role),
    };
  }

  /* ── Runs (qa-runs.service.ts) ── */

  private createRunRow(checklist: QaChecklist, branch: string, commitSha: string, createdBy: QaActor): RunRow {
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
    if (run.status === 'signed_off') throw nestError(409, 'This run is signed off. Reopen it to make changes.');
  }

  /** The backend accepts QA runs on the QA branch only: any other branch is a 400 the UI must never cause. */
  private requireHostedBranch(branch: string) {
    if (branch !== QA_BRANCH) {
      throw nestError(400, `QA verification runs are only supported on ${QA_BRANCH}.`);
    }
  }

  /** Commit resolution: the storefront's uat is deployed at UAT_SHA. */
  private resolveCommit(branch: string): { commitSha: string; commitSource: 'deployment' } | null {
    return branch === QA_BRANCH ? { commitSha: UAT_SHA, commitSource: 'deployment' } : null;
  }

  private currentRun(query: URLSearchParams): QaCurrentRunResponse {
    const branch = (query.get('branch') ?? '').trim();
    this.requireHostedBranch(branch);
    const resolved = this.resolveCommit(branch);
    if (!resolved) return { commitSha: null, commitSource: null, run: null };
    const checklistId = query.get('checklistId')?.trim();
    const run = checklistId
      ? this.runs.find((entry) => entry.checklistId === checklistId && entry.branch === branch && entry.commitSha === resolved.commitSha)
      : undefined;
    return { ...resolved, run: run ? this.assembleRun(run) : null };
  }

  private createRun(body: Record<string, unknown>): ApiReply {
    if (!canCreateRun(this.role)) throw nestError(403, 'Only QA, a lead, or an admin may start a verification run.');
    const branch = String(body.branch ?? '').trim();
    this.requireHostedBranch(branch);
    const checklist = this.checklists.find(
      (entry) => entry.id === body.checklistId && entry.archivedAt === null && entry.sharedProjectIds.includes(PROJECT_ID),
    );
    if (!checklist) throw nestError(409, 'This checklist is not shared to this project, or is archived.');
    const resolved = this.resolveCommit(branch);
    if (!resolved) throw nestError(409, `No deployed or pushed commit was found for ${branch}.`);
    const existing = this.runs.find(
      (entry) => entry.checklistId === checklist.id && entry.branch === branch && entry.commitSha === resolved.commitSha,
    );
    if (existing) return { status: 200, body: this.assembleRun(existing) };
    const run = this.createRunRow(checklist, branch, resolved.commitSha, this.actor);
    this.runs.push(run);
    return { status: 201, body: this.assembleRun(run) };
  }

  private updateItem(runId: string, itemId: string, body: Record<string, unknown>): QaRun {
    const run = this.requireRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    this.requireOpen(run);
    if (!personaAllowsRole(item.targetPersona, this.role)) throw nestError(403, 'You are not allowed to update this item.');
    const status = body.status as QaRunItemStatus | undefined;
    if (status === 'returned_to_dev' && !canSetReturnedToDev(this.role)) {
      throw nestError(403, 'Only QA, a lead, or an admin may return an item to development.');
    }
    const severity = body.defectSeverity !== undefined ? (body.defectSeverity as QaDefectSeverity | null) : item.defectSeverity;
    if ((status === 'failed' || status === 'returned_to_dev') && !severity) {
      throw nestError(400, 'A defect severity is required to mark this item failed or returned to dev.');
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
    if (body.defectSeverity !== undefined) item.defectSeverity = body.defectSeverity as QaDefectSeverity | null;
    if (body.reproductionSteps !== undefined) item.reproductionSteps = body.reproductionSteps as string | null;
    item.rowVersion += 1;
    item.updatedAt = Date.now();
    run.updatedAt = new Date().toISOString();
    return this.assembleRun(run);
  }

  private requestRetest(runId: string, itemId: string, body: Record<string, unknown>): QaRun {
    const run = this.requireRun(runId);
    const item = run.items.find((entry) => entry.id === itemId);
    if (!item) throw nestError(404, 'QA run item not found');
    this.requireOpen(run);
    if (!canRequestRetest(this.role)) throw nestError(403, 'Only a developer, lead, or admin may request a retest.');
    if (item.status !== 'returned_to_dev') throw nestError(409, 'This item is not currently returned to dev.');
    item.status = 'pending';
    item.fixRequest = { requestedAt: new Date().toISOString(), requestedBy: this.actor, note: (body.note as string | undefined) ?? null };
    item.verifiedBy = null;
    item.verifiedAt = null;
    item.rowVersion += 1;
    item.updatedAt = Date.now();
    return this.assembleRun(run);
  }

  private signoff(runId: string, body: Record<string, unknown>): QaRun {
    const run = this.requireRun(runId);
    this.requireOpen(run);
    if (!canSignOff(this.role)) throw nestError(403, 'Only QA, a lead, or an admin may sign off a run.');
    const verdict = body.verdict as QaVerdict;
    if (verdict === 'APPROVED') {
      const notPassed = run.items.filter((item) => item.status !== 'passed').length;
      if (notPassed > 0) {
        throw nestError(409, `${notPassed} item(s) are not yet passed; an APPROVED sign-off requires every item to be passed.`);
      }
    }
    if (verdict === 'CONDITIONAL') {
      if (run.items.some((item) => item.status === 'pending' || item.status === 'in_progress')) {
        throw nestError(409, 'A CONDITIONAL sign-off requires no item to remain pending or in progress.');
      }
      if (typeof body.conditions !== 'string' || !body.conditions.trim()) {
        throw nestError(400, 'conditions is required for a CONDITIONAL verdict.');
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
    if (!canDispatchAutomation(this.role)) throw nestError(403, 'Only QA, a lead, or an admin may run Playwright for this run.');
    this.requireOpen(run);
    return { workflowFile: '40-alphaci-verify.yml', ref: run.branch, headSha: run.commitSha, targetsRunCommit: true };
  }

  private returnedItems(): QaReturnedItem[] {
    return this.runs
      .filter((run) => run.status === 'open')
      .flatMap((run) => run.items.filter((item) => item.status === 'returned_to_dev').map((item) => ({ run, item })))
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
      .filter((run) => run.status === 'open' && run.branch === QA_BRANCH && run.commitSha === UAT_SHA)
      .flatMap((run) => run.items.filter((item) => item.targetPersona === 'developer').map((item) => ({ run, item })))
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
      .filter((entry) => entry.archivedAt === null && entry.sharedProjectIds.includes(projectId))
      .map((checklist) => {
        const run = this.runs.find((entry) => entry.checklistId === checklist.id && entry.branch === QA_BRANCH && entry.commitSha === UAT_SHA);
        const verdict = run?.status === 'signed_off' ? (run.signoff?.verdict ?? null) : null;
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
    if (checklists.length === 0) return ['No QA checklist is shared with this project.'];
    const head = `${QA_BRANCH} @ ${UAT_SHA.slice(0, 7)}`;
    return checklists
      .filter((entry) => entry.approvedForHead !== true)
      .map((entry) => {
        if (!entry.runId) return `${String(entry.name)} has no QA run on ${head}.`;
        if (entry.runStatus !== 'signed_off') return `${String(entry.name)} is not signed off on ${head}.`;
        return `${String(entry.name)} is signed off ${String(entry.verdict)}, not APPROVED, on ${head}.`;
      });
  }

  promotion(projectId: string): QaPromotionStatusWire {
    this.requireProject(projectId);
    const checklists = this.promotionChecklists(projectId);
    const reasons = this.promotionReasons(checklists);
    return {
      qaBranch: QA_BRANCH,
      targetBranch: 'main',
      headSha: UAT_SHA,
      checklists,
      eligible: reasons.length === 0,
      reasons,
      pullRequest: this.promotionPr ? { ...this.promotionPr, headSha: UAT_SHA } : null,
      canMerge: canMergePromotion(this.role),
    };
  }

  private mergePromotion(projectId: string): QaPromotionMergeWire {
    if (!canMergePromotion(this.role)) throw nestError(403, 'Only a team lead or admin may merge to main.');
    const status = this.promotion(projectId);
    if (!status.eligible) {
      throw new HttpError(409, {
        code: 'QA_PROMOTION_BLOCKED',
        message: 'QA has not approved every shared checklist on the current uat commit.',
        reasons: status.reasons,
      });
    }
    const pullRequest = this.promotionPr ?? PROMOTION_PR;
    if (this.mergeMode === 'refuse') {
      // GitHub refused: 200 with merged:false and its own words.
      return { merged: false, sha: null, message: GITHUB_REFUSAL, pullRequest };
    }
    this.promotionPr = null;
    return { merged: true, sha: MERGE_SHA, message: 'Pull Request successfully merged', pullRequest };
  }

  /* ── Assembly (row → contract) ── */

  private toRunItem(run: RunRow, row: ItemRow): QaRunItem {
    const { updatedAt: _updatedAt, ...fields } = row;
    return {
      ...fields,
      runId: run.id,
      canUpdate: run.status === 'open' && personaAllowsRole(row.targetPersona, this.role),
      previous: null,
      automated: matchAutomated(row, this.automation),
    };
  }

  private summary(items: ItemRow[]) {
    const byStatus: Record<QaRunItemStatus, number> = { pending: 0, in_progress: 0, passed: 0, failed: 0, blocked: 0, returned_to_dev: 0 };
    let blockers = 0;
    for (const item of items) {
      byStatus[item.status] += 1;
      if (OPEN_DEFECT_STATUSES.includes(item.status) && item.defectSeverity === 'blocker') blockers += 1;
    }
    const openDefects = OPEN_DEFECT_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
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
      items: [...run.items].sort((a, b) => a.position - b.position).map((item) => this.toRunItem(run, item)),
      permissions: {
        canUpdateItems: open && run.items.some((item) => personaAllowsRole(item.targetPersona, this.role)),
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
    const rank = (severity: QaDefectSeverity | null) => (severity === null ? 3 : { blocker: 0, major: 1, minor: 2 }[severity]);
    return {
      schemaVersion: 'qa-report/v1',
      generatedAt: new Date().toISOString(),
      frozen: row.frozen !== null,
      project: { id: PROJECT_ID, repoFullName: PROJECTS[0].repoFullName, name: PROJECTS[0].serviceName },
      run,
      summary: {
        totalItems: total,
        passed: byStatus.passed,
        failed: byStatus.failed,
        blocked: byStatus.blocked,
        returnedToDev: byStatus.returned_to_dev,
        pending: byStatus.pending,
        inProgress: byStatus.in_progress,
        completionRate: total > 0 ? Math.round((byStatus.passed / total) * 10000) / 10000 : 0,
        openDefects,
        blockers,
        verdict: run.signoff?.verdict ?? null,
      },
      defects: run.items
        .filter((item): item is QaRunItem & { status: 'failed' | 'blocked' | 'returned_to_dev' } => OPEN_DEFECT_STATUSES.includes(item.status))
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
        .sort((a, b) => rank(a.severity) - rank(b.severity) || a.position - b.position),
      automatedResults: run.automation ?? null,
      signoffHistory: [],
    };
  }

  /** The Markdown the report endpoint serves. The client copies it verbatim, so its exact text does not matter here. */
  reportMarkdown(runId: string): string {
    const report = this.buildReport(runId);
    const rows = report.run.items.map((item) => `| ${item.position + 1} | ${item.title} | ${item.status} |`);
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
    if (format === 'md') return { body: this.reportMarkdown(runId), contentType: 'text/markdown; charset=utf-8' };
    return { body: this.buildReport(runId) };
  }
}

/* ── Assertions ──────────────────────────────────────────────────────────── */

const WAIT_MS = 15_000;

async function eventually(description: string, check: () => Promise<boolean> | boolean, timeout = WAIT_MS) {
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
  await eventually(`${description} to be absent`, async () => (await locator.count()) === 0);
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
async function neverShown(backend: QaMockBackend, locator: Locator, description: string, since = 0) {
  await eventually('the capabilities response to be served', () =>
    backend.calls.some((call) => call.path === '/capabilities' && call.at >= since),
  );
  await eventually(`the app to stop calling the API for ${API_QUIET_MS}ms`, () => {
    const last = backend.calls.at(-1);
    return last !== undefined && Date.now() - last.at >= API_QUIET_MS;
  });
  assert.equal(await locator.count(), 0, `${description} must not be shown`);
}

/** The DOM text, not innerText: CSS text-transform (the uppercase role badge) must not change what is asserted. */
async function textOf(locator: Locator): Promise<string> {
  return ((await locator.first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

async function expectText(locator: Locator, expected: string | RegExp, description: string) {
  await eventually(`${description} to read ${String(expected)}`, async () => {
    if ((await locator.count()) === 0) return false;
    const actual = await textOf(locator);
    return typeof expected === 'string' ? actual.includes(expected) : expected.test(actual);
  });
}

function onlyCall<T>(calls: T[], description: string): T {
  assert.equal(calls.length, 1, `expected exactly one ${description}, saw ${calls.length}`);
  return calls[0];
}

/* ── Page helpers ────────────────────────────────────────────────────────── */

async function openProjectTab(page: Page, baseUrl: string, tab: string) {
  await page.goto(`${baseUrl}/projects/${PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  await visible(tabs.getByRole('tab', { name: 'Overview' }), 'the project section tabs');
  if (tab !== 'Overview') await tabs.getByRole('tab', { name: tab, exact: true }).click();
}

/** The primary sidebar's link to a page (its label is always in the DOM, hidden by opacity). */
function sidebarLink(page: Page, label: string): Locator {
  return page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label, exact: true });
}

/**
 * Opens the header's team picker (a button + listbox popover), reports whether
 * it offers the "Create team" (+) button, and closes it again with Escape.
 */
async function pickerOffersCreate(page: Page): Promise<boolean> {
  const trigger = page.getByRole('button', { name: /^Active workspace:/ });
  await visible(trigger, 'the workspace picker');
  await trigger.click();
  const listbox = page.getByRole('listbox', { name: 'Active workspace' });
  await visible(listbox, 'the open workspace picker');
  await visible(listbox.getByRole('option', { name: WORKSPACE.name, selected: true }), 'the current team, marked selected');
  const offers = (await page.getByRole('button', { name: 'Create team', exact: true }).count()) === 1;
  await page.keyboard.press('Escape');
  await absent(listbox, 'the open workspace picker');
  return offers;
}

/** Opens a page from the primary sidebar, as a person would, and waits for its URL. */
async function openSidebarPage(page: Page, label: string, pathname: string) {
  const link = sidebarLink(page, label);
  await visible(link, `the sidebar's ${label} link`);
  await link.click();
  await eventually(`the ${pathname} page`, () => new URL(page.url()).pathname === pathname);
}

async function expectRoleBadge(page: Page, role: AppRole) {
  const badge = page.locator(`.app-header-identity .sidebar-role-badge--${role}`);
  await expectText(badge, ROLE_BADGES[role], `the header role badge for ${role}`);
}

function runItem(page: Page, title: string): Locator {
  return page.locator('li.qa-run-item').filter({ has: page.locator('.qa-run-item__title', { hasText: title }) });
}

/** The recorded status pill beside an item's title (not the Automated badge next to it). */
const STATUS_PILL = '.qa-run-item__states > .qa-pill';

function statusSelect(page: Page, position: number): Locator {
  return page.locator('label.qa-status-select').filter({ hasText: `Status of item ${position}` }).locator('select');
}

/* ── Journeys ────────────────────────────────────────────────────────────── */

interface JourneyContext {
  page: Page;
  context: BrowserContext;
  backend: QaMockBackend;
  baseUrl: string;
}

interface Journey {
  id: string;
  title: string;
  backend: () => QaMockBackend;
  /** Browser permissions the journey needs (clipboard for Copy PR Markdown). */
  permissions?: string[];
  run: (ctx: JourneyContext) => Promise<void>;
}

/** (a) Team lead writes a checklist, shares it, and it lands on the project. */
async function leadCreatesAndSharesChecklist({ page, backend, baseUrl }: JourneyContext) {
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'lead');
  // The contrast for journey (d): a lead's workspace picker offers creation.
  assert.equal(await pickerOffersCreate(page), true, 'the workspace picker offers "Create team" to a lead');
  // /teams is the header team's members now; checklists have a page of their own.
  await visible(page.getByRole('heading', { name: /^Members/ }), 'the Members section on /teams');
  await visible(page.getByText('Ana QA').first(), 'the team roster on /teams');
  await openSidebarPage(page, 'Checklists', '/checklists');
  await visible(page.getByText('No QA checklists yet'), 'the empty checklist list');
  await page.getByRole('button', { name: 'Create the first checklist' }).click();

  await page.getByPlaceholder('Release smoke test').fill(RELEASE_CHECKLIST.name);
  await page.getByPlaceholder('When to run it and what it protects (optional)').fill(RELEASE_CHECKLIST.description);
  for (const [index, item] of RELEASE_CHECKLIST.items.entries()) {
    const n = index + 1;
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByLabel(`Item ${n} title`).fill(item.title);
    await page.getByLabel(`Who runs item ${n}`).selectOption(item.targetPersona);
    await page.getByLabel(`How item ${n} is verified`).selectOption(item.verificationType);
    if (item.testIdentifier) await page.getByLabel(`Test identifier for item ${n}`).fill(item.testIdentifier);
    if (item.description) await page.getByLabel(`Item ${n} notes`).fill(item.description);
  }
  await page.getByRole('button', { name: 'Create checklist' }).click();

  // The detail screen of what was just saved.
  const detail = page.locator('article.qa-detail');
  await expectText(detail.locator('.qa-detail__title'), RELEASE_CHECKLIST.name, 'the saved checklist title');
  await expectText(detail.locator('.qa-detail__meta'), '3 items', 'the item count');
  await expectText(detail.locator('.qa-detail__meta'), '1 automated', 'the automated count');
  await expectText(detail.locator('.qa-detail__meta'), 'Version 1', 'the version');
  await expectText(detail.locator('.qa-detail__shared'), 'No projects yet.', 'the unshared note');

  const create = onlyCall(backend.callsTo('POST', /^\/workspaces\/ws-checkout\/qa-checklists$/), 'checklist create');
  assert.equal(create.status, 201);
  assert.deepEqual(create.body, {
    name: RELEASE_CHECKLIST.name,
    description: RELEASE_CHECKLIST.description,
    items: RELEASE_CHECKLIST.items,
  });

  await detail.getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Share “${RELEASE_CHECKLIST.name}”` });
  await visible(dialog, 'the share dialog');
  await dialog.getByRole('checkbox', { name: /tone\/storefront-web/ }).check();
  await expectText(dialog.locator('.qa-share__legend'), '1 of 2 projects', 'the share selection summary');
  await dialog.getByRole('button', { name: 'Save sharing' }).click();
  await absent(dialog, 'the share dialog');
  await expectText(detail.locator('.qa-detail__chips'), 'tone/storefront-web', 'the shared project chip');
  const created = backend.checklists[0];
  const share = onlyCall(backend.callsTo('PUT', new RegExp(`^/qa-checklists/${created.id}/projects$`)), 'share request');
  assert.deepEqual(share.body, { projectIds: [PROJECT_ID] });

  await page.getByRole('button', { name: 'All checklists' }).click();
  const row = page.locator('button.qa-list-row').filter({ hasText: RELEASE_CHECKLIST.name });
  await expectText(row, 'Shared to 1 project', 'the list row sharing summary');

  await openProjectTab(page, baseUrl, 'Checklists');
  const card = page.locator('section.qa-project-card').filter({ has: page.getByRole('heading', { name: RELEASE_CHECKLIST.name }) });
  await visible(card, 'the shared checklist on the project Checklists tab');
  await expectText(card.locator('.qa-project-card__meta'), '3 items', 'the project card item count');
  for (const item of RELEASE_CHECKLIST.items) {
    await visible(card.locator('.qa-item__title', { hasText: item.title }), `the item "${item.title}"`);
  }
  await expectText(card.locator('code.qa-item__test'), RELEASE_CHECKLIST.items[0].testIdentifier ?? '', 'the Playwright test identifier');
  await visible(card.getByRole('link', { name: 'Manage in team' }), 'the lead-only Manage in team link');
}

/** (b) QA verifies the checklist on main, returns a defect, rejects, exports. */
async function qaVerifiesAndSignsOff({ page, context, backend, baseUrl }: JourneyContext) {
  // window.print() is the browser's; count calls instead of opening a dialog.
  await context.addInitScript(() => {
    const target = window as unknown as { __qaPrintCalls: number };
    target.__qaPrintCalls = 0;
    window.print = () => {
      target.__qaPrintCalls += 1;
    };
  });
  const checklist = backend.checklists[0];
  const [first, second, third] = RELEASE_CHECKLIST.items;

  await openProjectTab(page, baseUrl, 'QA Studio');
  await expectRoleBadge(page, 'qa');
  await expectText(page.locator('.qa-run-card__title'), checklist.name, 'the checklist under test');
  await expectText(page.getByLabel('Commit under test'), 'uat @ 9f8e7d6', 'the commit chip');

  // uat only: main is deployed (and production), but it is not offered anywhere.
  await expectText(page.locator('.qa-toolbar__env-chip'), 'uat', 'the fixed uat environment');
  assert.equal(await page.locator('.qa-toolbar select').count(), 0, 'no environment picker: uat is the only QA environment');
  assert.equal(await page.locator('.qa-device__frame').getAttribute('src'), `${PREVIEW_ORIGIN}/`, 'the frame shows the uat deployment');
  // Production readiness: QA Team reads it, only leads merge.
  const promo = page.getByRole('region', { name: 'Production readiness' });
  await expectText(promo.locator('.qa-promo__title'), 'Not ready for production', 'the promotion card for QA');
  await expectText(promo, checklist.name, 'the checklist row on the promotion card');
  await expectText(promo, 'Not verified on this commit yet', 'the unverified checklist state');
  await expectText(promo, 'Team leads merge uat into main once every checklist is approved.', 'who merges, for QA');
  await neverShown(backend, page.getByRole('button', { name: 'Merge to main' }), 'Merge to main for QA Team');
  const lookedUp = backend.callsTo('GET', /\/qa-runs\/current$/).map((call) => call.query.get('branch'));
  assert.ok(lookedUp.length > 0 && lookedUp.every((branch) => branch === QA_BRANCH), `run lookups only ever ask for uat (got ${lookedUp.join(', ')})`);

  await page.getByRole('button', { name: 'Start QA run on uat @ 9f8e7d6' }).click();
  await visible(runItem(page, first.title), 'the run items');
  const start = onlyCall(backend.callsTo('POST', /^\/projects\/project-1\/qa-runs$/), 'run start');
  assert.equal(start.status, 201);
  // Only the checklist and branch: the server, never the page, picks the commit.
  assert.deepEqual(start.body, { checklistId: checklist.id, branch: QA_BRANCH });
  const run = backend.runs[0];
  const [item1, item2, item3] = run.items;
  const patchesTo = (itemId: string) => backend.callsTo('PATCH', new RegExp(`/qa-runs/${run.id}/items/${itemId}$`));

  // CI failed on the Playwright item's own spec: it wears an Automated · Failed badge.
  const automated = runItem(page, first.title).locator('.qa-auto-badge');
  await expectText(automated, 'Automated', 'the automated badge');
  await expectText(automated, 'Failed', 'the automated status');
  await runItem(page, first.title).locator('button.qa-auto-toggle').click();
  await expectText(runItem(page, first.title).locator('.qa-auto-detail__name'), VERIFY_FAILURE_NAME, 'the matched failing test');
  for (const title of [second.title, third.title]) {
    assert.equal(await runItem(page, title).locator('.qa-auto-badge').count(), 0, `manual item "${title}" has no automated badge`);
  }
  await visible(page.getByRole('button', { name: 'Run Playwright' }), 'Run Playwright for QA');

  // ── Full screen: the page fills the viewport, the checklist floats over it. ──
  // Mark the frame, so "the site was never reloaded" is a fact, not a hope.
  await page.locator('.qa-device__frame').evaluate((frame) => {
    (frame as unknown as { __qaMark: string }).__qaMark = 'original';
  });
  const studio = page.locator('.qa-studio');
  await page.getByRole('button', { name: 'Full screen' }).click();
  await eventually('the studio to go full screen', async () => (await studio.getAttribute('data-full-screen')) === 'true');
  const studioBox = await studio.boundingBox();
  assert.deepEqual(studioBox, { x: 0, y: 0, width: 1440, height: 900 }, 'full screen covers the whole viewport');
  const launcher = page.locator('button.qa-launcher');
  await expectText(launcher, 'QA checklist · 0/3 passed', 'the launcher progress');
  await absent(page.getByRole('region', { name: 'QA checklist' }), 'the drawer before it is opened');

  await launcher.click();
  const drawer = page.getByRole('region', { name: 'QA checklist' });
  await visible(drawer, 'the floating checklist drawer');
  const drawerBox = await drawer.boundingBox();
  assert.ok(drawerBox && drawerBox.x + drawerBox.width <= 1440 - 15 && drawerBox.y + drawerBox.height <= 900 - 15, 'the drawer floats in the bottom-right corner');
  assert.equal(await page.locator('.qa-run-card').count(), 1, 'one run column, moved, never a second copy');

  // 1 → Passed, saved as soon as it is picked — from the floating drawer.
  await drawer.locator('label.qa-status-select').filter({ hasText: 'Status of item 1' }).locator('select').selectOption('passed');
  await expectText(runItem(page, first.title).locator(STATUS_PILL), 'Passed', 'item 1 passed');
  assert.deepEqual(onlyCall(patchesTo(item1.id), 'item 1 update').body, { expectedRowVersion: 1, status: 'passed' });
  // Automated evidence never rewrites what the tester recorded.
  assert.equal(backend.runs[0].items[0].status, 'passed');

  // 2 → Failed opens a details draft. Minimizing only hides the drawer: the draft survives.
  await statusSelect(page, 2).selectOption('failed');
  const editor = runItem(page, second.title).locator('form.qa-item-editor');
  await visible(editor, 'the item 2 details editor');
  await editor.getByPlaceholder('What went wrong').fill('Coupon applied twice on a two-line cart.');
  await drawer.getByRole('button', { name: 'Minimize checklist' }).click();
  await absent(drawer, 'the minimized drawer');
  await expectText(launcher, 'QA checklist · 1/3 passed', 'the launcher after item 1 passed');
  await launcher.click();
  await visible(editor, 'the item 2 draft after re-opening');
  assert.equal(await editor.getByPlaceholder('What went wrong').inputValue(), 'Coupon applied twice on a two-line cart.', 'the draft survived minimize');
  await expectText(runItem(page, first.title).locator(STATUS_PILL), 'Passed', 'item 1 still passed after re-opening');
  assert.equal(patchesTo(item2.id).length, 0, 'nothing was sent for item 2 by minimizing');

  // Leave full screen from the drawer: docked beside the page again, same frame.
  await drawer.getByRole('button', { name: 'Dock beside the page' }).click();
  await eventually('the studio to dock', async () => (await studio.getAttribute('data-full-screen')) === 'false');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'the page scrolls again');
  assert.equal(
    await page.locator('.qa-device__frame').evaluate((frame) => (frame as unknown as { __qaMark?: string }).__qaMark ?? null),
    'original',
    'the preview iframe was never remounted',
  );

  // 2 → Failed needs a severity first: the UI refuses to send it without one.
  await visible(editor, 'the item 2 details editor, docked');
  await editor.getByRole('button', { name: 'Mark Failed' }).click();
  await expectText(editor.getByRole('alert'), 'Choose a severity before marking this item Failed.', 'the severity validation');
  assert.equal(patchesTo(item2.id).length, 0, 'Failed without a severity must not be sent');
  await editor.locator('label', { hasText: 'Severity' }).locator('select').selectOption('major');
  await editor.getByPlaceholder('What went wrong').fill('Coupon applied twice on a two-line cart.');
  await editor.getByRole('button', { name: 'Mark Failed' }).click();
  await absent(editor, 'the item 2 details editor');
  await expectText(runItem(page, second.title).locator(STATUS_PILL), 'Failed', 'item 2 failed');
  await expectText(runItem(page, second.title).locator('.qa-run-item__facts .qa-severity'), 'Major', 'item 2 severity');
  assert.deepEqual(onlyCall(patchesTo(item2.id), 'item 2 update').body, {
    expectedRowVersion: 1,
    status: 'failed',
    notes: 'Coupon applied twice on a two-line cart.',
    defectSeverity: 'major',
  });

  // 3 → Returned to dev as a Blocker, with how to reproduce it.
  await statusSelect(page, 3).selectOption('returned_to_dev');
  const returnEditor = runItem(page, third.title).locator('form.qa-item-editor');
  await returnEditor.locator('label', { hasText: 'Severity' }).locator('select').selectOption('blocker');
  await returnEditor.getByPlaceholder('What went wrong').fill('No confirmation email for card orders.');
  await returnEditor.locator('label', { hasText: 'Reproduction steps' }).locator('textarea').fill('1. Pay with the saved card\n2. Wait five minutes\n3. Inbox is empty');
  await returnEditor.getByRole('button', { name: 'Mark Returned to dev' }).click();
  await absent(returnEditor, 'the item 3 details editor');
  await expectText(runItem(page, third.title).locator(STATUS_PILL), 'Returned to dev', 'item 3 returned');
  await expectText(runItem(page, third.title).locator('.qa-run-item__facts .qa-severity'), 'Blocker', 'item 3 severity');
  assert.deepEqual(onlyCall(patchesTo(item3.id), 'item 3 update').body, {
    expectedRowVersion: 1,
    status: 'returned_to_dev',
    notes: 'No confirmation email for card orders.',
    defectSeverity: 'blocker',
    reproductionSteps: '1. Pay with the saved card\n2. Wait five minutes\n3. Inbox is empty',
  });
  await expectText(page.locator('.qa-summary__facts'), '2 open defects', 'the open defect count');
  await expectText(page.locator('.qa-summary__facts'), '1 blocker', 'the blocker count');

  // Approved is refused, with the reason, before anything is sent.
  await expectText(page.locator('.qa-run-card__foot-text'), '2 items are not passed yet.', 'the readiness line');
  await page.getByRole('button', { name: 'Sign off', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign off this run' });
  await visible(dialog, 'the sign-off dialog');
  const approved = dialog.locator('label.qa-verdict').filter({ hasText: 'Approved' });
  assert.equal(await approved.locator('input[type="radio"]').isDisabled(), true, 'Approved must be refused');
  await expectText(approved.locator('.qa-verdict__hint'), '2 items are not passed yet.', 'why Approved is refused');
  await dialog.locator('label.qa-verdict').filter({ hasText: 'Rejected' }).locator('input').check();
  const summary = 'Card orders get no confirmation email; returned as a blocker.';
  await dialog.getByPlaceholder('What was tested, and anything the team should know').fill(summary);
  await dialog.getByRole('button', { name: 'Sign off', exact: true }).click();
  await absent(dialog, 'the sign-off dialog');
  const signoffs = backend.callsTo('POST', /\/signoff$/);
  assert.deepEqual(onlyCall(signoffs, 'sign-off').body, { verdict: 'REJECTED', summary });

  // Signed off: the banner says so, and nothing on the run can be changed.
  const banner = page.locator('.qa-signoff-banner');
  await expectText(banner, 'Signed off', 'the signed-off banner');
  await expectText(banner.locator('.qa-signoff-banner__title'), 'Rejected', 'the verdict');
  await expectText(banner, summary, 'the sign-off summary');
  await expectText(banner, 'Signed-off runs are read-only.', 'the read-only note');
  await absent(page.locator('label.qa-status-select'), 'item status controls');
  await absent(page.getByRole('button', { name: /^(Add notes|Edit notes)$/ }), 'item notes controls');
  await absent(page.getByRole('button', { name: 'Sign off', exact: true }), 'the Sign off button');
  assert.equal(await page.getByRole('button', { name: 'Run Playwright' }).isDisabled(), true, 'Run Playwright is disabled once signed off');

  // Export: PDF opens the print page, Markdown is copied, JSON is downloaded.
  const reportPath = `/projects/${PROJECT_ID}/qa/report/${run.id}`;
  await page.getByRole('button', { name: 'Export report' }).click();
  const menu = page.getByRole('menu', { name: 'Export report' });
  const pdf = menu.getByRole('menuitem', { name: /Download PDF/ });
  assert.equal(await pdf.getAttribute('href'), `${reportPath}?print=1`);
  assert.equal(await pdf.getAttribute('target'), '_blank');

  await menu.getByRole('menuitem', { name: /Copy PR Markdown/ }).click();
  await expectText(page.locator('button.qa-export__trigger'), 'Copied', 'the Copied confirmation');
  const markdownCall = onlyCall(backend.callsTo('GET', new RegExp(`^${reportPath.replace('/qa/report/', '/qa-runs/')}/report$`)), 'Markdown report request');
  assert.equal(markdownCall.query.get('format'), 'md');
  assert.equal(markdownCall.accept, 'text/markdown');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboard.replace(/\r\n/g, '\n'), backend.reportMarkdown(run.id));

  await page.getByRole('button', { name: /Export report|Copied/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menu', { name: 'Export report' }).getByRole('menuitem', { name: /Download JSON/ }).click(),
  ]);
  assert.equal(download.suggestedFilename(), 'QA-Report-storefront-web-uat-9f8e7d6.json');
  const saved = JSON.parse(await readFile(await download.path(), 'utf8')) as QaReport;
  assert.equal(saved.schemaVersion, 'qa-report/v1');
  assert.equal(saved.frozen, true);
  assert.equal(saved.summary.verdict, 'REJECTED');
  assert.deepEqual(saved.defects.map((defect) => [defect.title, defect.severity]), [
    [third.title, 'blocker'],
    [second.title, 'major'],
  ]);
  const jsonCalls = backend.callsTo('GET', /\/report$/).filter((call) => call.query.get('format') === 'json');
  assert.equal(jsonCalls.length, 1, 'one JSON report request from Download JSON');

  // The new tab's URL is rewritten (?print=1 dropped) as soon as it prints, so
  // read what it was opened on from the navigation request itself.
  const navigations: URL[] = [];
  context.on('request', (request) => {
    if (request.isNavigationRequest()) navigations.push(new URL(request.url()));
  });
  await page.getByRole('button', { name: 'Export report' }).click();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('menu', { name: 'Export report' }).getByRole('menuitem', { name: /Download PDF/ }).click(),
  ]);
  await visible(popup.getByRole('heading', { name: 'QA Report', level: 1 }), 'the printable report');
  const opened = navigations.filter((url) => url.pathname === reportPath);
  assert.deepEqual(opened.map((url) => url.search), ['?print=1'], 'Download PDF opens the print page once, with ?print=1');
  await eventually('the print dialog to be requested once', async () =>
    (await popup.evaluate(() => (window as unknown as { __qaPrintCalls: number }).__qaPrintCalls)) === 1,
  );
  // ?print=1 is dropped once used, so a refresh does not print again.
  await eventually('?print=1 to be dropped', () => new URL(popup.url()).search === '');
  await popup.close();
}

/** (c) A developer fixes what QA returned and asks for a re-test. */
async function developerRequestsRetest({ page, backend, baseUrl }: JourneyContext) {
  const [, second, third] = RELEASE_CHECKLIST.items;
  const run = backend.runs[0];
  const [item1, item2, item3, item4] = run.items;

  await openProjectTab(page, baseUrl, 'Overview');
  await expectRoleBadge(page, 'member');
  const card = page.locator('section.qa-returned');
  await expectText(card.locator('#qa-mine-title'), 'My QA items', 'the My QA items card');
  await expectText(card.locator('.qa-returned__count'), '2', 'two returned items');
  const row = card.locator('li.qa-returned__row').filter({ hasText: third.title });
  await expectText(row.locator('.qa-returned__head .qa-severity'), 'Blocker', 'the returned severity');
  await expectText(row, '1. Pay with the saved card', 'the reproduction steps');
  await expectText(row.locator('.qa-returned__meta'), 'uat @ 9f8e7d6', 'the commit it was returned on');
  await expectText(row.locator('.qa-returned__meta'), `Returned by @${PEOPLE.qa.login}`, 'who returned it');

  await row.getByRole('button', { name: 'Mark fixed & request re-test' }).click();
  await row.getByLabel('Note to QA (optional)').fill('Mailer queue was paused on uat; resumed and added an alert.');
  await row.getByRole('button', { name: 'Request re-test' }).click();
  await expectText(card.locator('.qa-returned__count'), '1', 'one returned item left');
  await absent(card.locator('li.qa-returned__row').filter({ hasText: third.title }), 'the fixed item on the card');
  await visible(card.locator('li.qa-returned__row').filter({ hasText: second.title }), 'the item still returned');
  const retest = onlyCall(backend.callsTo('POST', new RegExp(`/items/${item3.id}/request-retest$`)), 're-test request');
  assert.deepEqual(retest.body, { note: 'Mailer queue was paused on uat; resumed and added an alert.' });
  assert.equal(item3.status, 'pending', 'a re-test sends the item back to pending');
  assert.equal(item2.status, 'returned_to_dev', 'the other returned item is untouched');

  // Section 2: the developer item of the current uat run, recorded from the Overview
  // with the studio's own rules, and never "Returned to dev".
  const checks = card.getByRole('region', { name: 'Your checks on uat @ 9f8e7d6' });
  await visible(checks, 'the "Your checks on uat @ 9f8e7d6" section');
  const devRow = checks.locator('li.qa-mine__row').filter({ hasText: DEVELOPER_ITEM.title });
  await expectText(devRow, DEVELOPER_ITEM.testIdentifier ?? '', 'the developer item test identifier');
  const devSelect = devRow.getByLabel(`Status of ${DEVELOPER_ITEM.title}`);
  const offered = await devSelect.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  assert.deepEqual(offered, ['pending', 'in_progress', 'passed', 'failed', 'blocked'], 'a developer is never offered Returned to dev');
  await devSelect.selectOption('passed');
  await expectText(devRow.locator('.qa-mine__head .qa-pill'), 'Passed', 'the developer item passed');
  await expectText(devRow, `Passed by @${PEOPLE.member.login}`, 'who passed it');
  const devPatch = onlyCall(backend.callsTo('PATCH', new RegExp(`/qa-runs/${run.id}/items/${item4.id}$`)), 'developer item update');
  assert.deepEqual(devPatch.body, { expectedRowVersion: 1, status: 'passed' });
  assert.equal(item4.status, 'passed', 'the server recorded the developer item');

  // QA Studio is for QA Team, Team leads and Admins: a Developer reads the
  // shared checklists and fixes what QA returns, from the card above.
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  await visible(tabs.getByRole('tab', { name: 'Checklists', exact: true }), 'the Checklists tab for a Developer');
  await neverShown(backend, tabs.getByRole('tab', { name: 'QA Studio', exact: true }), 'the QA Studio tab for a Developer');

  // A deep link to #qa cannot reveal it either: it lands on Overview.
  await page.goto(`${baseUrl}/projects/${PROJECT_ID}#qa`, { waitUntil: 'domcontentloaded' });
  await visible(tabs.getByRole('tab', { name: 'Overview', selected: true }), 'Overview for a #qa deep link');
  await neverShown(backend, page.locator('.qa-studio'), 'QA Studio for a Developer');
  assert.equal(backend.callsTo('GET', /\/qa-runs\/current$/).length, 0, 'the studio never looked up a run for a Developer');
  assert.equal(item1.status, 'passed', 'the QA item is untouched');
  assert.equal(item4.status, 'passed', 'nothing but the developer changed the developer item');
}

/** (d) A QA Team member sees their badge, cannot create a workspace or manage checklists. */
async function qaTeamCannotCreate({ page, backend, baseUrl }: JourneyContext) {
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'qa');
  assert.equal(await pickerOffersCreate(page), false, 'QA Team cannot create a workspace');
  assert.equal(await page.getByTestId('create-workspace-button').count(), 0, 'no create-workspace button');

  // QA Team reads the roster but cannot change it.
  await visible(page.getByText('Tone Lead').first(), 'the team roster');
  await neverShown(backend, page.getByRole('button', { name: 'Add member' }), 'Add member for QA Team');

  // Checklists are readable, not writable, for QA Team.
  await openSidebarPage(page, 'Checklists', '/checklists');
  const row = page.locator('button.qa-list-row').filter({ hasText: RELEASE_CHECKLIST.name });
  await visible(row, 'the team checklist');
  await neverShown(backend, page.getByRole('button', { name: 'New checklist' }), 'New checklist for QA Team');
  await row.click();
  await expectText(page.locator('article.qa-detail .qa-detail__title'), RELEASE_CHECKLIST.name, 'the checklist detail');
  for (const action of ['Edit checklist', 'Share', 'Archive']) {
    await neverShown(backend, page.getByRole('button', { name: action, exact: true }), `${action} for QA Team`);
  }

  // Activity & audit is for the team's leads (the server answers 403), so the
  // sidebar does not offer it; typed in, the page says so instead of failing.
  await neverShown(backend, sidebarLink(page, 'Activity'), "the sidebar's Activity link for QA Team");
  assert.equal(backend.callsTo('GET', /\/activity$/).length, 0, 'nothing asked for the activity feed');
  backend.activityForbiddenArmed = true;
  await page.goto(`${baseUrl}/activity`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByText('The activity feed is available to group leads.'), 'the activity access message');
}

/** (e) The capabilities response lacks qaChecklists: every QA surface is gone. */
async function capabilityAbsentHidesQa({ page, backend, baseUrl }: JourneyContext) {
  await openProjectTab(page, baseUrl, 'Overview');
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  await visible(tabs.getByRole('tab', { name: 'Settings' }), 'the rest of the tab strip');
  // Positive control: the Overview only asks for previews once it has read a
  // capabilities response (previewDeployments), so the flags are applied.
  await eventually('the capability-gated previews request', () => backend.callsTo('GET', /^\/projects\/project-1\/previews$/).length > 0);
  for (const hidden of ['Checklists', 'QA Studio']) {
    await neverShown(backend, tabs.getByRole('tab', { name: hidden, exact: true }), `the ${hidden} tab`);
  }
  // A returned item exists on the server, but without the capability the card is not drawn.
  await neverShown(backend, page.getByRole('heading', { name: /Returned by QA/ }), 'the Returned by QA card');

  const teamsLoadedAt = Date.now();
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('heading', { name: /^Members/ }), 'the Members section');
  // The sidebar keeps Activity but drops Checklists without the capability.
  await visible(sidebarLink(page, 'Activity'), "the sidebar's Activity link");
  await neverShown(backend, sidebarLink(page, 'Checklists'), "the sidebar's Checklists link", teamsLoadedAt);
  // A lead's Activity opens on its card, with no hero above it.
  await openSidebarPage(page, 'Activity', '/activity');
  await visible(page.getByRole('heading', { level: 2, name: 'Activity & audit' }), 'the Activity & audit card');
  await visible(page.getByText('No activity yet'), 'the empty activity feed');
  assert.equal(await page.locator('.workflow-page-header').count(), 0, 'no hero container on /activity');

  // Typed straight in, /checklists says the feature is off instead of loading it.
  await page.goto(`${baseUrl}/checklists`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByText('QA checklists are not switched on for this deployment.'), 'the checklists-off notice');

  // Nothing QA was even asked for: the tabs are hidden because the flag is
  // missing, not because a QA request failed.
  assert.deepEqual(backend.calls.filter((call) => /qa-/.test(call.path)).map((call) => call.path), []);
}

/** (h) Team lead: the project explorer — list, open, attach, move (409 then real), archive, create links. */
/**
 * A multi-repository Project reads as one product: its card opens the
 * frontend's page, titled with the Project, and a switch opens the backend on
 * the tab in use. "Manage project" goes back to the Project's detail.
 */
async function leadSwitchesRepositories({ page, backend, baseUrl }: JourneyContext) {
  await page.goto(`${baseUrl}/workflows`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'lead');
  const storefront = page
    .locator('li.pf-card')
    .filter({ has: page.locator('.pf-card__name', { hasText: /^storefront$/ }) });
  await storefront.locator('a.pf-card__open').click();
  await eventually('the storefront frontend page', () => new URL(page.url()).pathname === `/projects/${PROJECT_ID}`);

  const header = page.locator('.project-folder-header');
  await expectText(header.locator('h1'), 'storefront', 'the Project title');
  await expectText(header.locator('.project-folder-header__repo'), 'tone/storefront-web', 'the frontend subtitle');
  const repos = page.getByRole('radiogroup', { name: 'Repositories in storefront' });
  const frontend = repos.getByRole('radio', { name: /storefront-web/ });
  const backendOption = repos.getByRole('radio', { name: /orders-api/ });
  assert.equal(await frontend.getAttribute('aria-checked'), 'true', 'the frontend is the page on screen');
  assert.equal(await backendOption.getAttribute('aria-checked'), 'false');
  await expectText(frontend, 'FRONTEND', 'the frontend role label');
  await expectText(backendOption, 'BACKEND', 'the backend role label');

  // Keyboard: arrows move focus only; Enter opens the backend on the same tab.
  const tabs = page.getByRole('tablist', { name: 'Project sections' });
  await tabs.getByRole('tab', { name: 'Checklists', exact: true }).click();
  await visible(tabs.getByRole('tab', { name: 'Checklists', selected: true }), 'the Checklists tab');
  await frontend.focus();
  await page.keyboard.press('ArrowRight');
  await expectText(page.locator('[role="radio"]:focus'), 'orders-api', 'focus on the backend option');
  assert.equal(new URL(page.url()).pathname, `/projects/${PROJECT_ID}`, 'an arrow alone does not navigate');
  await page.keyboard.press('Enter');
  await eventually('the backend page on the Checklists tab', () => {
    const url = new URL(page.url());
    return url.pathname === '/projects/project-2' && url.hash === '#checklists';
  });
  await visible(tabs.getByRole('tab', { name: 'Checklists', selected: true }), 'the Checklists tab kept across the switch');
  await expectText(page.locator('.project-folder-header__repo'), 'tone/orders-api', 'the backend subtitle');
  await expectText(page.locator('.project-folder-header h1'), 'storefront', 'the Project title kept');
  await eventually('the backend option to be current', async () =>
    (await page.getByRole('radio', { name: /orders-api/ }).getAttribute('aria-checked')) === 'true',
  );
  assert.equal(backend.callsTo('GET', /^\/projects\/project-2\/folder$/).length >= 1, true, 'the backend page read its folder');

  // Manage project: the Projects page, on this team, opened on this Project's detail.
  const manage = page.getByRole('link', { name: 'Manage project' });
  assert.equal(
    await manage.getAttribute('href'),
    `/workflows?group=${WORKSPACE.id}&project=${STOREFRONT_FOLDER}`,
  );
  await manage.click();
  await expectText(page.locator('.pf-detail__title'), 'storefront', 'the Project detail opened by the link');

  // An old link from before the split still lands on the same detail.
  await page.goto(
    `${baseUrl}/teams?workspace=${WORKSPACE.id}&section=projects&project=${STOREFRONT_FOLDER}`,
    { waitUntil: 'domcontentloaded' },
  );
  await eventually('the old /teams link to be forwarded to /workflows', () => {
    const url = new URL(page.url());
    return url.pathname === '/workflows' && url.searchParams.get('project') === STOREFRONT_FOLDER;
  });
  await expectText(page.locator('.pf-detail__title'), 'storefront', 'the Project detail opened by the old link');
}

async function leadOrganisesProjects({ page, backend, baseUrl }: JourneyContext) {
  await page.goto(`${baseUrl}/teams`, { waitUntil: 'domcontentloaded' });
  await expectRoleBadge(page, 'lead');
  // The team rail is gone: /teams is members only, and Projects is the sidebar's.
  assert.equal(await page.getByRole('tablist', { name: 'Team sections' }).count(), 0, 'no team section rail');
  await visible(sidebarLink(page, 'Checklists'), "the sidebar's Checklists link");
  await openSidebarPage(page, 'Projects', '/workflows');

  // One heading, the team's Project count beside it; no team dropdown.
  const heading = page.locator('.current-projects-title');
  await expectText(heading, /Projects\s*2/, 'the Projects heading with its count');
  // (The header's own team picker is a listbox button too; the page has none.)
  assert.equal(await page.locator("#main-content [aria-haspopup='listbox']").count(), 0, 'no team dropdown on the page');

  // The list, in the server's order (by name).
  const cards = page.locator('li.pf-card');
  await eventually('two Project cards', async () => (await cards.count()) === 2);
  assert.deepEqual(await page.locator('.pf-card__name').allTextContents(), ['loyalty', 'storefront']);
  const storefront = cards.filter({ has: page.locator('.pf-card__name', { hasText: /^storefront$/ }) });
  // No per-repository BACKEND/FRONTEND chips on a card.
  assert.equal(await cards.locator('.pf-chip').count(), 0, 'no repository chips on the cards');
  await expectText(storefront.locator('.pf-card__meta'), '2 repositories', 'the storefront repository count');
  await expectText(storefront.locator('.pf-card__meta'), '1 checklist', 'the storefront checklist count');
  const loyalty = cards.filter({ has: page.locator('.pf-card__name', { hasText: /^loyalty$/ }) });
  await expectText(loyalty, '0 repositories', 'the empty loyalty Project');
  assert.equal(await page.locator('.pf-unfiled').count(), 0, 'every repository is filed');

  // One Create project, and the ⋯ menu for the other two ways in.
  assert.equal(await page.getByTestId('create-project-button').count(), 1, 'one Create project');
  assert.equal(await page.getByRole('button', { name: 'New Project' }).count(), 0, 'no separate New Project button');
  const more = page.getByRole('button', { name: 'More ways to create' });
  assert.equal(await more.getAttribute('aria-haspopup'), 'menu');
  await more.click();
  const menu = page.getByRole('menu');
  assert.deepEqual(
    await menu.getByRole('menuitem').locator('.create-menu-label').allTextContents(),
    ['Empty project', 'Add repository'],
  );
  assert.equal(
    await menu.getByRole('menuitem', { name: /Add repository/ }).getAttribute('href'),
    `/workflows?tab=setup&group=${WORKSPACE.id}`,
  );
  // Keyboard: Escape closes it and hands focus back.
  await page.keyboard.press('Escape');
  await absent(page.getByRole('menu'), 'the create menu');
  assert.equal(await more.evaluate((element) => element === document.activeElement), true, 'focus back on ⋯');

  // Empty project (the New Project dialog).
  await more.press('ArrowDown');
  await menu.getByRole('menuitem', { name: /Empty project/ }).press('Enter');
  const newDialog = page.getByRole('dialog', { name: 'New Project' });
  await newDialog.getByPlaceholder('checkout').fill('payments');
  await newDialog.getByRole('button', { name: 'Create Project' }).click();
  await absent(newDialog, 'the New Project dialog');
  const create = onlyCall(backend.callsTo('POST', /^\/groups\/ws-checkout\/projects$/), 'Project create');
  assert.deepEqual(create.body, { name: 'payments' });
  await eventually('the new Project in the list', async () => (await cards.count()) === 3);
  await expectText(heading, /Projects\s*3/, 'the heading count after creating');

  // The card opens storefront as one product, on its frontend's page; Manage
  // (beside it, not inside it) opens the Project's detail.
  assert.equal(await storefront.locator('a.pf-card__open').getAttribute('href'), `/projects/${PROJECT_ID}`);
  assert.equal(await loyalty.locator('a.pf-card__open').count(), 0, 'an empty Project has no page to open');

  // Open storefront.
  await storefront.getByRole('button', { name: 'Manage storefront' }).click();
  await expectText(page.locator('.pf-detail__title'), 'storefront', 'the Project detail title');
  assert.equal(await page.getByRole('link', { name: 'Verify in QA Studio' }).getAttribute('href'), `/projects/${PROJECT_ID}#qa`);
  assert.equal(
    await page.getByRole('link', { name: 'Create repository in this Project' }).first().getAttribute('href'),
    `/workflows?tab=setup&group=${WORKSPACE.id}&project=${STOREFRONT_FOLDER}`,
  );

  // Checklists: the release checklist covers one of two repositories; attach another with PATCH.
  const rows = page.locator('li.pf-checklist');
  await expectText(rows.filter({ hasText: RELEASE_CHECKLIST.name }), 'Some repositories', 'the partial checklist');
  await page.locator('.pf-attach select').selectOption({ label: 'Accessibility pass' });
  await page.getByRole('button', { name: 'Attach to this Project' }).click();
  await expectText(rows.filter({ hasText: 'Accessibility pass' }), 'All repositories', 'the attached checklist');
  const attach = onlyCall(backend.callsTo('PATCH', /^\/qa-checklists\/[^/]+\/projects$/), 'checklist attach');
  assert.deepEqual(attach.body, { add: [PROJECT_ID, 'project-2'] });
  await page.getByRole('button', { name: `Detach ${RELEASE_CHECKLIST.name} from this Project` }).click();
  await absent(rows.filter({ hasText: RELEASE_CHECKLIST.name }), 'the detached checklist');
  const detach = backend.callsTo('PATCH', /^\/qa-checklists\/[^/]+\/projects$/)[1];
  assert.deepEqual(detach.body, { remove: [PROJECT_ID, 'project-2'] });
  assert.equal(backend.callsTo('PUT', /\/projects$/).length, 0, 'never the PUT full replace from a Project');

  // Move: someone else moves orders-api first (409), then a real move.
  backend.moveConflictArmed = true;
  const foldersReads = () => backend.callsTo('GET', /^\/groups\/ws-checkout\/project-folders$/).length;
  const readsBefore = foldersReads();
  await page.getByRole('button', { name: 'Move orders-api to another Project' }).click();
  const moveDialog = page.getByRole('dialog', { name: 'Move orders-api' });
  await moveDialog.getByRole('radio', { name: /loyalty/ }).check();
  await moveDialog.getByRole('button', { name: 'Move repository' }).click();
  await expectText(moveDialog.getByRole('alert'), 'This repository was moved by someone else. Refresh and try again.', 'the conflict message');
  await eventually('the explorer to refetch after the conflict', () => foldersReads() > readsBefore);
  assert.equal(backend.expectedErrors.length, 1, 'exactly the armed 409');
  await moveDialog.getByRole('button', { name: 'Cancel' }).click();
  await absent(moveDialog, 'the move dialog');
  await eventually('orders-api to have left storefront', async () =>
    (await page.getByRole('button', { name: 'Move orders-api to another Project' }).count()) === 0,
  );

  await page.getByRole('button', { name: 'Move storefront-web to another Project' }).click();
  const secondMove = page.getByRole('dialog', { name: 'Move storefront-web' });
  await secondMove.getByRole('radio', { name: /loyalty/ }).check();
  await secondMove.getByRole('button', { name: 'Move repository' }).click();
  await absent(secondMove, 'the second move dialog');
  const move = backend.callsTo('POST', /^\/repositories\/repo-web\/move$/);
  assert.equal(move.length, 1);
  assert.deepEqual(move[0].body, { deliveryProjectId: LOYALTY_FOLDER });
  const notice = page.locator('.pf-notice');
  await expectText(notice, 'Moved storefront-web to loyalty. storefront has no repositories now.', 'the emptied-Project notice');

  // Archive the emptied Project: it leaves the list.
  await notice.getByRole('button', { name: 'Archive storefront' }).click();
  await expectText(notice, 'Archived storefront.', 'the archive confirmation');
  onlyCall(backend.callsTo('POST', new RegExp(`^/delivery-projects/${STOREFRONT_FOLDER}/archive$`)), 'Project archive');
  await eventually('storefront to leave the list', async () =>
    (await page.locator('.pf-card__name').allTextContents()).join(',') === 'loyalty,payments',
  );
  await expectText(loyalty.locator('.pf-card__meta'), '2 repositories', 'loyalty now holds both repositories');

  // Create repository in loyalty: the wizard opens pre-scoped to the team and Project.
  await loyalty.getByRole('button', { name: 'Manage loyalty' }).click();
  await page.getByRole('link', { name: 'Create repository in this Project' }).first().click();
  await eventually('the wizard URL to carry ?group= and ?project=', () => {
    const url = new URL(page.url());
    return url.pathname === '/workflows' && url.searchParams.get('group') === WORKSPACE.id && url.searchParams.get('project') === LOYALTY_FOLDER;
  });
  await expectText(page.getByTestId('setup-target-project'), `Project: ${WORKSPACE.name} / loyalty`, 'the wizard Project line');
  // Dev StrictMode runs the lookup effect twice; what matters is that it was resolved at all.
  assert.ok(backend.callsTo('GET', new RegExp(`^/delivery-projects/${LOYALTY_FOLDER}$`)).length > 0, 'the wizard Project lookup');
}

/** The lead's route to the promotion card, with its parts. */
function promotionCard(page: Page) {
  const card = page.getByRole('region', { name: 'Production readiness' });
  return { card, title: card.locator('.qa-promo__title'), merge: page.locator('button.qa-promo__merge') };
}

/** (f) Team lead: not ready (reasons) -> sign off Approved on the current head -> ready -> Merge to main from the drawer -> merged. */
async function leadMergesToMain({ page, backend, baseUrl }: JourneyContext) {
  const checklist = backend.checklists[0];
  await openProjectTab(page, baseUrl, 'QA Studio');
  await expectRoleBadge(page, 'lead');
  const { card, title, merge } = promotionCard(page);
  await expectText(title, 'Not ready for production', 'the not-ready title');
  // Folded by default (the item list needs the height); unfold to read why.
  const toggle = card.locator('button.qa-promo__toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'the card starts folded');
  await toggle.click();
  await visible(card.locator('.qa-promo__reasons'), 'the unfolded reasons');
  await expectText(card.locator('.qa-promo__route'), 'uat @ 9f8e7d6 → main', 'the promotion route');
  await expectText(card.locator('.qa-promo__reasons'), `${checklist.name} is not signed off on uat @ 9f8e7d6.`, 'the server reason');
  await expectText(card.locator('.qa-promo__row'), 'Run in progress — not signed off yet', 'the checklist row state');
  assert.equal(await merge.isDisabled(), true, 'Merge to main is disabled while not eligible');
  const whyId = await merge.getAttribute('aria-describedby');
  assert.ok(whyId, 'the disabled button is described by its reason');
  await expectText(page.locator(`[id="${whyId}"]`), 'Merging opens once every shared checklist is signed off Approved on uat @ 9f8e7d6.', 'why it is disabled');
  const readsBefore = backend.callsTo('GET', /\/qa\/promotion$/).length;

  // Sign off Approved on the current head, from the same studio.
  await page.getByRole('button', { name: 'Sign off', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign off this run' });
  await visible(dialog, 'the sign-off dialog');
  assert.equal(await dialog.locator('label.qa-verdict').filter({ hasText: 'Approved' }).locator('input').isChecked(), true, 'Approved is the default');
  await dialog.getByRole('button', { name: 'Sign off', exact: true }).click();
  await absent(dialog, 'the sign-off dialog');
  assert.deepEqual(onlyCall(backend.callsTo('POST', /\/signoff$/), 'sign-off').body, { verdict: 'APPROVED' });

  // The card re-reads readiness on its own.
  await expectText(title, 'Ready for production', 'the ready title after sign-off');
  assert.ok(backend.callsTo('GET', /\/qa\/promotion$/).length > readsBefore, 'readiness was re-read after the sign-off');
  await expectText(card.locator('.qa-promo__row'), 'Approved for this commit', 'the approved tick');
  await absent(card.locator('.qa-promo__reasons'), 'the blocking reasons');
  assert.equal(await merge.isDisabled(), false, 'Merge to main is enabled once eligible');
  await expectText(card.locator('a.qa-promo__pr'), 'Promotion PR #42', 'the promotion PR link');
  assert.equal(await card.locator('a.qa-promo__pr').getAttribute('href'), PROMOTION_PR.url);
  assert.equal(await card.locator('a.qa-promo__pr').getAttribute('target'), '_blank');

  // Full screen: the SAME card rides in the floating drawer.
  await page.getByRole('button', { name: 'Full screen' }).click();
  await page.locator('button.qa-launcher').click();
  const drawer = page.getByRole('region', { name: 'QA checklist' });
  await visible(drawer, 'the floating drawer');
  await visible(drawer.getByRole('region', { name: 'Production readiness' }), 'the promotion card inside the drawer');
  assert.equal(await page.locator('.qa-promo').count(), 1, 'one promotion card, moved, never a second copy');
  assert.equal(await page.locator('.qa-run-card').count(), 1, 'one run column');

  // Merge to main, confirmed, from the drawer.
  await drawer.getByRole('button', { name: 'Merge to main' }).click();
  const confirm = page.getByRole('dialog', { name: 'Merge uat into main?' });
  await visible(confirm, 'the merge confirmation');
  await expectText(confirm, 'Merge tone/storefront-web uat @ 9f8e7d6 into main through pull request #42, with your GitHub account.', 'the confirmation sentence');
  const confirmBox = await confirm.boundingBox();
  assert.ok(confirmBox && confirmBox.width > 300, 'the confirmation is laid out against the viewport, not clipped by the drawer');
  assert.equal(backend.callsTo('POST', /\/qa\/promotion\/merge$/).length, 0, 'nothing merged before confirming');
  await confirm.getByRole('button', { name: 'Merge to main' }).click();
  await absent(confirm, 'the merge confirmation');
  const mergeCall = onlyCall(backend.callsTo('POST', /\/qa\/promotion\/merge$/), 'merge request');
  assert.deepEqual(mergeCall.body, {}, 'the merge sends no body: the server picks the commit and the PR');
  const outcome = drawer.locator('.qa-promo-outcome');
  await expectText(outcome, 'Merged into main', 'the merged outcome');
  await expectText(outcome, `main updated · merge commit ${MERGE_SHA.slice(0, 7)}`, 'the merge commit');
  assert.equal(await merge.isDisabled(), true, 'the merged head is not offered again');
  await expectText(card.locator('.qa-promo__foot'), 'No promotion pull request is open yet.', 'the PR is gone after the merge');
}

/** (g) Team lead: GitHub refuses the merge (required review), its words shown verbatim. */
async function leadMergeRefused({ page, backend, baseUrl }: JourneyContext) {
  await openProjectTab(page, baseUrl, 'QA Studio');
  const { card, title, merge } = promotionCard(page);
  await expectText(title, 'Ready for production', 'the ready title');
  await merge.click();
  const confirm = page.getByRole('dialog', { name: 'Merge uat into main?' });
  await confirm.getByRole('button', { name: 'Merge to main' }).click();
  await absent(confirm, 'the merge confirmation');
  const outcome = card.locator('.qa-promo-outcome');
  await expectText(outcome.locator('.qa-promo-outcome__title'), 'GitHub refused the merge', 'the refusal title');
  assert.equal(await textOf(outcome.locator('blockquote')), GITHUB_REFUSAL, "GitHub's refusal, verbatim");
  await expectText(outcome, 'A reviewer must approve the pull request on GitHub', 'the unblock hint');
  assert.equal(await outcome.getByRole('link', { name: /Open pull request #42 on GitHub/ }).getAttribute('href'), PROMOTION_PR.url);
  onlyCall(backend.callsTo('POST', /\/qa\/promotion\/merge$/), 'merge request');
  assert.equal(await merge.isDisabled(), false, 'still mergeable once GitHub allows it');
}

/* A shared checklist whose run on uat's current head has every item passed; signed off Approved when `approved`. */
function seedPassedRun(backend: QaMockBackend, approved: boolean) {
  const checklist = backend.seedChecklist(RELEASE_CHECKLIST, [PROJECT_ID]);
  const run = backend.seedRun(checklist, { id: PEOPLE.qa.id, login: PEOPLE.qa.login });
  for (const item of run.items) {
    backend.seedItem(run, item.position, { status: 'passed', verifiedBy: { id: PEOPLE.qa.id, login: PEOPLE.qa.login }, verifiedAt: ago(20 * MINUTE) });
  }
  if (approved) {
    run.status = 'signed_off';
    run.signoff = {
      id: 'signoff-seeded',
      verdict: 'APPROVED',
      summary: null,
      conditions: null,
      signedBy: { id: PEOPLE.qa.id, login: PEOPLE.qa.login },
      signedAt: ago(10 * MINUTE),
    };
    run.frozen = backend.assembleRun(run);
  }
}

/* A run on main that QA already worked through: 1 passed, 2 and 3 returned. */
function seedReturnedRun(backend: QaMockBackend) {
  const checklist = backend.seedChecklist({ ...RELEASE_CHECKLIST, items: [...RELEASE_CHECKLIST.items, DEVELOPER_ITEM] }, [PROJECT_ID]);
  const run = backend.seedRun(checklist, { id: PEOPLE.qa.id, login: PEOPLE.qa.login });
  const byQa = { verifiedBy: { id: PEOPLE.qa.id, login: PEOPLE.qa.login } };
  backend.seedItem(run, 0, { ...byQa, status: 'passed', verifiedAt: ago(50 * MINUTE), updatedAt: Date.now() - 50 * MINUTE });
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
    reproductionSteps: '1. Pay with the saved card\n2. Wait five minutes\n3. Inbox is empty',
    verifiedAt: ago(30 * MINUTE),
    updatedAt: Date.now() - 30 * MINUTE,
  });
}

const JOURNEYS: Journey[] = [
  {
    id: 'a',
    title: 'Team lead: create a 3-item checklist, share it, see it on the project',
    backend: () => new QaMockBackend('lead'),
    run: leadCreatesAndSharesChecklist,
  },
  {
    id: 'b',
    title: 'QA Team: uat only, full screen + floating checklist, validate, return to dev, sign off Rejected, export',
    permissions: ['clipboard-read', 'clipboard-write'],
    backend: () => {
      const backend = new QaMockBackend('qa');
      backend.seedChecklist(RELEASE_CHECKLIST, [PROJECT_ID]);
      return backend;
    },
    run: qaVerifiesAndSignsOff,
  },
  {
    id: 'c',
    title: 'Developer: My QA items (request re-test, record a developer item), no QA Studio tab',
    backend: () => {
      const backend = new QaMockBackend('member');
      seedReturnedRun(backend);
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
    title: 'Team lead: not ready (reasons) -> sign off Approved -> ready -> Merge to main from the drawer -> merged',
    backend: () => {
      const backend = new QaMockBackend('lead');
      seedPassedRun(backend, false);
      return backend;
    },
    run: leadMergesToMain,
  },
  {
    id: 'g',
    title: 'Team lead: GitHub refuses the merge, its refusal shown verbatim',
    backend: () => {
      const backend = new QaMockBackend('lead');
      seedPassedRun(backend, true);
      backend.mergeMode = 'refuse';
      return backend;
    },
    run: leadMergeRefused,
  },
  {
    id: 'e',
    title: 'Capabilities without qaChecklists: no Checklists / QA Studio tab, no sidebar Checklists, /checklists says off',
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
    title: 'Team lead: project explorer — list, open, attach/detach, move (409 + real), archive, create-in-Project link',
    backend: () => {
      const backend = new QaMockBackend('lead');
      backend.seedChecklist(RELEASE_CHECKLIST, [PROJECT_ID]);
      backend.seedChecklist({ name: 'Accessibility pass', description: null, items: [DEVELOPER_ITEM] }, []);
      return backend;
    },
    run: leadOrganisesProjects,
  },
  {
    id: 'i',
    title: 'Team lead: a Project opens on its frontend, switches to the backend on the same tab, Manage project deep link',
    backend: () => new QaMockBackend('lead'),
    run: leadSwitchesRepositories,
  },
];

/* ── Runner ──────────────────────────────────────────────────────────────── */

const PREVIEW_HTML = '<!doctype html><title>Storefront</title><h1>Checkout</h1>';

/**
 * A failed step, with what was on screen and what the mock refused. With
 * E2E_QA_ARTIFACTS=<dir> a full-page screenshot is saved there too.
 */
async function withFailureContext(error: unknown, page: Page, backend: QaMockBackend, id: string): Promise<Error> {
  const lines = [error instanceof Error ? error.message : String(error)];
  // Where in the journey it stopped: the helper and the journey step that called it.
  const frames = (error instanceof Error ? (error.stack ?? '') : '')
    .split('\n')
    .filter((line) => line.includes('qa-journeys'))
    .slice(0, 3);
  for (const frame of frames) lines.push(`at: ${frame.trim().replace(/^at /, '')}`);
  if (error instanceof Error && error.cause instanceof Error) lines.push(`cause: ${error.cause.message.split('\n')[0]}`);
  const screen = await page
    .locator('body')
    .innerText({ timeout: 2_000 })
    .catch(() => '(page unavailable)');
  lines.push(`url: ${page.url()}`, `visible text:\n${screen.slice(0, 1500)}`);
  if (backend.refusals.length > 0) lines.push(`mock refusals:\n${backend.refusals.join('\n')}`);
  const dir = process.env.E2E_QA_ARTIFACTS;
  if (dir) {
    const file = `${dir}/qa-${id}-failure.png`;
    await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
    lines.push(`screenshot: ${file}`);
  }
  return new Error(lines.join('\n'));
}

async function runJourney(browser: Browser, baseUrl: string, journey: Journey) {
  const backend = journey.backend();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const problems: string[] = [];
  try {
    if (journey.permissions) await context.grantPermissions(journey.permissions, { origin: baseUrl });
    // Context-wide, so the print page opened by Download PDF is mocked too.
    await context.route('**/api/v1/**', (route) => backend.handle(route));
    for (const origin of [PREVIEW_ORIGIN, MAIN_PREVIEW_ORIGIN]) {
      await context.route(`${origin}/**`, (route) => text(route, 200, PREVIEW_HTML, 'text/html'));
    }
    context.on('page', (page) => {
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
      });
    });
    const page = await context.newPage();
    try {
      await journey.run({ page, context, backend, baseUrl });
    } catch (error) {
      throw await withFailureContext(error, page, backend, journey.id);
    }
  } finally {
    await context.close();
  }
  // The browser logs every 4xx as a console error; one per reply the journey
  // provoked on purpose is expected, anything beyond that still fails.
  for (const expected of backend.expectedErrors) {
    const status = expected.split(' ')[0];
    const index = problems.findIndex((line) => line.includes(`status of ${status}`));
    if (index >= 0) problems.splice(index, 1);
  }
  problems.push(...backend.refusals.map((refusal) => `unexpected API reply: ${refusal}`));
  if (problems.length > 0) throw new Error(problems.join('\n'));
}

/** Runs the QA journeys (all, or the comma-separated ids in `only`). Returns how many passed; throws if any failed. */
export async function runQaJourneys(browser: Browser, baseUrl: string, only?: string): Promise<number> {
  const wanted = only ? new Set(only.split(',').map((id) => id.trim())) : null;
  const selected = JOURNEYS.filter((journey) => !wanted || wanted.has(journey.id));
  assert.ok(selected.length > 0, `E2E_QA_ONLY=${only ?? ''} matches no journey (have ${JOURNEYS.map((j) => j.id).join(', ')})`);
  const failures: string[] = [];
  for (const journey of selected) {
    const started = Date.now();
    try {
      await runJourney(browser, baseUrl, journey);
      console.log(`PASS qa:${journey.id} ${journey.title} (${Date.now() - started}ms)`);
    } catch (error) {
      const detail = error instanceof Error ? `${error.message}${error.cause instanceof Error ? `\n  cause: ${error.cause.message}` : ''}` : String(error);
      console.error(`FAIL qa:${journey.id} ${journey.title}\n  ${detail.replace(/\n/g, '\n  ')}`);
      failures.push(journey.id);
    }
  }
  if (failures.length > 0) {
    throw new Error(`QA journeys failed: ${failures.join(', ')} (${selected.length - failures.length}/${selected.length} passed)`);
  }
  return selected.length;
}
