import type {
  DeploymentTarget,
  EnvLane,
  EnvVarMetadata,
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
  ProjectDeploymentsResponse,
  ProjectPreviewsResponse,
} from "@/shared/api/contracts";

import { deployedAgo, previewStatusTone } from "../../model/projects-rules";
import { providerDisplayName } from "./provider-urls";

/*
 * The Hosting tab, organised by the real data model: one deployment target
 * (a service), then its environments, then the deploys and variables of the
 * selected environment. A customer repository's branches map onto three
 * environments: `main` is Production, `uat` is the QA environment with its own
 * address, and every other branch is a preview. Pure rules only; the view
 * models read the data and the views draw what these return.
 */

export const PRODUCTION_BRANCH = "main";
export const UAT_BRANCH = "uat";

export type HostingEnvironmentKind = "production" | "uat" | "previews";

/** A status dot's colour. `idle`: nothing deployed (or not known). */
export type HostingTone = "ok" | "pending" | "danger" | "idle";

export interface HostingEnvironment {
  kind: HostingEnvironmentKind;
  label: string;
  /** The variable lane this environment's variables live in. */
  lane: EnvLane;
  /** The branch it deploys; null for Previews, which is many branches. */
  branch: string | null;
  tone: HostingTone;
  /** One line under the label: "main · live", "uat · not deployed", "2 branches". */
  subLabel: string;
  /** Production / UAT: the branch's current deployment, when the previews read knows it. */
  preview: ProjectBranchPreview | null;
  /** Previews: every preview branch, sorted. Empty for the other two. */
  previewBranches: string[];
}

export interface HostingEnvironmentInput {
  target: Pick<DeploymentTarget, "id" | "branchName">;
  /** The branch previews read; null while it is unknown (off, loading or failed). */
  previews: ReadonlyArray<ProjectBranchPreview> | null;
  metadata: ReadonlyArray<EnvVarMetadata>;
  deployments: ReadonlyArray<ProjectDeploymentHistoryItem>;
}

const STATUS_WORDS: Record<ProjectBranchPreview["status"], string> = {
  queued: "queued",
  building: "building",
  ready: "live",
  failed: "failed",
  canceled: "canceled",
  unknown: "unknown",
  not_deployed: "not deployed",
};

/** The branches with an environment of their own (not a preview). */
export function isNamedEnvironmentBranch(branch: string): boolean {
  return branch === PRODUCTION_BRANCH || branch === UAT_BRANCH;
}

function forTarget<T extends { targetId: string }>(items: ReadonlyArray<T>, targetId: string): T[] {
  return items.filter((item) => item.targetId === targetId);
}

function metadataForTarget(metadata: ReadonlyArray<EnvVarMetadata>, targetId: string): EnvVarMetadata[] {
  return metadata.filter((item) => item.deploymentTargetId === targetId && !item.removedAt);
}

/**
 * Every branch this target is known to serve: the branch it tracks, the
 * branches the previews read lists, and the branches its variables are scoped
 * to. Deployment history only counts while the previews read is unknown: it
 * keeps branches long gone, which the previews read has already dropped.
 */
export function targetBranchSet(input: HostingEnvironmentInput): Set<string> {
  const branches = new Set<string>([input.target.branchName].filter(Boolean));
  for (const preview of forTarget(input.previews ?? [], input.target.id)) branches.add(preview.branch);
  for (const item of metadataForTarget(input.metadata, input.target.id)) {
    if (item.gitBranch) branches.add(item.gitBranch);
  }
  if (input.previews === null) {
    for (const deploy of forTarget(input.deployments, input.target.id)) {
      if (deploy.branch) branches.add(deploy.branch);
    }
  }
  return branches;
}

/** The deployment of one branch of this target, if the previews read has it. */
export function previewForBranch(
  previews: ReadonlyArray<ProjectBranchPreview> | null,
  targetId: string,
  branch: string,
): ProjectBranchPreview | null {
  return forTarget(previews ?? [], targetId).find((preview) => preview.branch === branch) ?? null;
}

export function environmentTone(preview: Pick<ProjectBranchPreview, "status"> | null): HostingTone {
  if (!preview || preview.status === "not_deployed") return "idle";
  return previewStatusTone(preview.status);
}

/** "live", "not deployed", or "status unknown" while previews could not be read. */
export function environmentStatusWord(preview: Pick<ProjectBranchPreview, "status"> | null, previewsKnown: boolean): string {
  if (preview) return STATUS_WORDS[preview.status];
  return previewsKnown ? "not deployed" : "status unknown";
}

function branchEnvironment(
  kind: "production" | "uat",
  branch: string,
  input: HostingEnvironmentInput,
): HostingEnvironment {
  const preview = previewForBranch(input.previews, input.target.id, branch);
  return {
    kind,
    label: kind === "production" ? "Production" : "UAT",
    lane: kind === "production" ? "production" : "preview",
    branch,
    tone: environmentTone(preview),
    subLabel: `${branch} · ${environmentStatusWord(preview, input.previews !== null)}`,
    preview,
    previewBranches: [],
  };
}

const TONE_RANK: Record<HostingTone, number> = { danger: 3, pending: 2, ok: 1, idle: 0 };

/** The loudest of several tones: one failed preview colours the whole tab. */
export function loudestTone(tones: ReadonlyArray<HostingTone>): HostingTone {
  return tones.reduce<HostingTone>((loudest, tone) => (TONE_RANK[tone] > TONE_RANK[loudest] ? tone : loudest), "idle");
}

export function branchCountLabel(count: number): string {
  return `${count} ${count === 1 ? "branch" : "branches"}`;
}

function previewsEnvironment(branches: string[], input: HostingEnvironmentInput): HostingEnvironment {
  const tones = branches.map((branch) => environmentTone(previewForBranch(input.previews, input.target.id, branch)));
  return {
    kind: "previews",
    label: "Previews",
    lane: "preview",
    branch: null,
    tone: loudestTone(tones),
    subLabel: branchCountLabel(branches.length),
    preview: null,
    previewBranches: branches,
  };
}

/**
 * The environment switcher's tabs for one target: Production always, UAT only
 * when the repository has a `uat` lane or branch, Previews only when there is
 * at least one other branch.
 */
export function deriveHostingEnvironments(input: HostingEnvironmentInput): HostingEnvironment[] {
  const branches = targetBranchSet(input);
  const environments = [branchEnvironment("production", PRODUCTION_BRANCH, input)];
  if (branches.has(UAT_BRANCH)) environments.push(branchEnvironment("uat", UAT_BRANCH, input));
  const previewBranches = [...branches].filter((branch) => !isNamedEnvironmentBranch(branch)).sort();
  if (previewBranches.length) environments.push(previewsEnvironment(previewBranches, input));
  return environments;
}

/** The environment a kind names, or the first one (Production) when it is not offered. */
export function selectEnvironment(
  environments: ReadonlyArray<HostingEnvironment>,
  kind: HostingEnvironmentKind,
): HostingEnvironment {
  return environments.find((environment) => environment.kind === kind) ?? environments[0];
}

/** The preview branch to show: the one asked for while it exists, else the first. */
export function resolvePreviewBranch(branches: ReadonlyArray<string>, asked: string | null): string | null {
  if (asked && branches.includes(asked)) return asked;
  return branches[0] ?? null;
}

/* ── Roving tab focus (WAI-ARIA tabs) ─────────────────────────────────────── */

const TAB_STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** The tab a key moves to from `index`, wrapping; null for any other key. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const step = TAB_STEPS[key];
  if (step === undefined) return null;
  return (index + step + count) % count;
}

/* ── Deploys ──────────────────────────────────────────────────────────────── */

export interface EnvironmentDeploys {
  items: ProjectDeploymentHistoryItem[];
  /**
   * False when the history carries no branches, so it could not be filtered:
   * the items are the service's latest, and each row names its branch.
   */
  byBranch: boolean;
}

function newestFirst(a: ProjectDeploymentHistoryItem, b: ProjectDeploymentHistoryItem): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/** This target's deploys, newest first. */
export function targetDeploys(
  deployments: ReadonlyArray<ProjectDeploymentHistoryItem>,
  targetId: string,
): ProjectDeploymentHistoryItem[] {
  return forTarget(deployments, targetId).sort(newestFirst);
}

function deployMatches(deploy: ProjectDeploymentHistoryItem, environment: Pick<HostingEnvironment, "kind" | "branch">): boolean {
  if (!deploy.branch) return false;
  if (environment.kind === "previews") return !isNamedEnvironmentBranch(deploy.branch);
  return deploy.branch === environment.branch;
}

/**
 * The deploys of one environment of a target, newest first: its branch's (or,
 * for Previews, every preview branch's). History that names no branches at all
 * cannot be filtered, so it comes back whole with `byBranch: false`.
 */
export function deploysForEnvironment(
  deployments: ReadonlyArray<ProjectDeploymentHistoryItem>,
  targetId: string,
  environment: Pick<HostingEnvironment, "kind" | "branch">,
): EnvironmentDeploys {
  const all = targetDeploys(deployments, targetId);
  if (!all.some((deploy) => deploy.branch)) return { items: all, byBranch: false };
  return { items: all.filter((deploy) => deployMatches(deploy, environment)), byBranch: true };
}

/** How many recent deploys an environment shows before "All deploys". */
export const RECENT_DEPLOY_LIMIT = 5;

/* ── The one provider notice ──────────────────────────────────────────────── */

export interface HostingNoticeInput {
  provider: DeploymentTarget["provider"];
  deployments: Pick<ProjectDeploymentsResponse, "mode" | "providerError"> | null;
  deploymentsError: string | null;
  previews: Pick<ProjectPreviewsResponse, "providerError"> | null;
  previewsError: string | null;
}

function providerUnanswered(input: HostingNoticeInput): boolean {
  if (input.deployments?.providerError || input.deployments?.mode === "unavailable") return true;
  return Boolean(input.previews?.providerError);
}

/**
 * The single notice the Hosting tab shows when deploy history or branch
 * status could not be read, or null. The provider's own silence names it;
 * ALPHACI failing to answer says so instead. Never two notices, never the
 * raw error text.
 */
export function hostingNotice(input: HostingNoticeInput): string | null {
  if (providerUnanswered(input)) {
    return `${providerDisplayName(input.provider)} didn't answer, so deploy history may be incomplete.`;
  }
  if (input.deploymentsError || input.previewsError) {
    return "ALPHACI couldn't load deploy history, so it may be incomplete.";
  }
  return null;
}

/* ── Service header ───────────────────────────────────────────────────────── */

const SLOT_LABELS: Readonly<Record<string, string>> = { frontend: "Frontend", backend: "Backend" };

function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? `${slot.slice(0, 1).toUpperCase()}${slot.slice(1)}`;
}

export interface ServiceMeta {
  /** "Vercel · Frontend · deploys from Git" */
  summary: string;
  buildCommand: string | null;
  rootDirectory: string;
}

/** The header's one quiet meta line, in parts so the commands can be set in mono. */
export function serviceMeta(
  target: Pick<DeploymentTarget, "provider" | "slot" | "buildCommand" | "rootDirectory" | "imageUrl">,
): ServiceMeta {
  const source = target.imageUrl ? "deploys an image" : "deploys from Git";
  return {
    summary: [providerDisplayName(target.provider), slotLabel(target.slot), source].join(" · "),
    buildCommand: target.buildCommand?.trim() || null,
    rootDirectory: target.rootDirectory?.trim() || ".",
  };
}

const TARGET_STATUS: Readonly<Record<DeploymentTarget["status"], { label: string; tone: HostingTone }>> = {
  active: { label: "Active", tone: "ok" },
  missing: { label: "Missing at provider", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
};

export function targetStatusPill(status: DeploymentTarget["status"]): { label: string; tone: HostingTone } {
  return TARGET_STATUS[status] ?? { label: status, tone: "idle" };
}

/** Where "Open in Vercel" goes: the server's dashboard URL, else the provider's convention. */
export function providerDashboardHref(
  target: Pick<DeploymentTarget, "dashboardUrl">,
  fallback: string | null,
): string | null {
  return target.dashboardUrl?.trim() || fallback;
}

/* ── Variables ────────────────────────────────────────────────────────────── */

function laneKeys(
  metadata: ReadonlyArray<EnvVarMetadata>,
  targetId: string,
  lane: EnvLane,
  branch: string | null,
): Set<string> {
  return new Set(variablesInScope(metadata, targetId, lane, branch).map((item) => item.key));
}

/**
 * One environment's variables on one target, by key: the production lane, or
 * one preview branch's lane. Removed rows are not variables any more.
 */
export function variablesInScope(
  metadata: ReadonlyArray<EnvVarMetadata>,
  targetId: string,
  lane: EnvLane,
  branch: string | null,
): EnvVarMetadata[] {
  return metadataForTarget(metadata, targetId)
    .filter((item) => item.lane === lane && (lane === "production" || item.gitBranch === branch))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * The lane check: keys set in the target's production lane that this lane
 * lacks, sorted. A variable missing from one lane is a common reason a preview
 * works and production does not (or the reverse). Always empty for the
 * production lane itself.
 */
export function missingLaneKeys(
  metadata: ReadonlyArray<EnvVarMetadata>,
  targetId: string,
  lane: EnvLane,
  branch: string | null,
): string[] {
  if (lane === "production") return [];
  const here = laneKeys(metadata, targetId, lane, branch);
  return [...laneKeys(metadata, targetId, "production", null)].filter((key) => !here.has(key)).sort();
}

export function variableCountLabel(count: number): string {
  return `${count} ${count === 1 ? "variable" : "variables"}`;
}

/** "Production · branch main", "Preview · branch uat". */
export function variablesScopeLabel(lane: EnvLane, branch: string | null): string {
  if (lane === "production") return `Production · branch ${PRODUCTION_BRANCH}`;
  return `Preview · branch ${branch ?? ""}`;
}

/** "Production · branch main · 6 variables", "Preview · branch uat · 4 variables". */
export function variablesScopeLine(lane: EnvLane, branch: string | null, count: number): string {
  return `${variablesScopeLabel(lane, branch)} · ${variableCountLabel(count)}`;
}

/** "set 2d ago by lim". */
export function variableSetLabel(item: Pick<EnvVarMetadata, "lastProvisionedAt" | "lastProvisionedBy">, now: number = Date.now()): string {
  const by = item.lastProvisionedBy ? ` by ${item.lastProvisionedBy}` : "";
  return `set ${deployedAgo(item.lastProvisionedAt, now)}${by}`;
}

/** "N variables set in Production are missing here". */
export function missingKeysHeadline(count: number): string {
  return `${variableCountLabel(count)} set in Production ${count === 1 ? "is" : "are"} missing here`;
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

export type HostingEmptyBody = "create" | "lead_only" | "disabled" | "not_provisioned";

/** What the "Host this repository" card offers this viewer. */
export function hostingEmptyBody(input: {
  canManage: boolean;
  envProvisioningEnabled: boolean;
  provisioned: boolean;
}): HostingEmptyBody {
  if (!input.canManage) return "lead_only";
  if (!input.envProvisioningEnabled) return "disabled";
  return input.provisioned ? "create" : "not_provisioned";
}

/* ── Deployment card ──────────────────────────────────────────────────────── */

/**
 * Where an environment answers: its branch's stable address from the previews
 * read, else (Production only) the service's own public URL.
 */
export function environmentAddress(
  environment: Pick<HostingEnvironment, "kind" | "preview">,
  servicePublicUrl: string | null,
): string | null {
  const own = environment.preview?.previewUrl?.trim();
  if (own) return own;
  return environment.kind === "production" ? servicePublicUrl : null;
}

/** Known to have nothing deployed: the previews read says so, or does not list the branch. */
export function isKnownUndeployed(
  environment: Pick<HostingEnvironment, "preview">,
  previewsKnown: boolean,
): boolean {
  if (environment.preview) return environment.preview.status === "not_deployed";
  return previewsKnown;
}

/** The one sentence an environment with nothing deployed gets instead of an empty box. */
export function undeployedSentence(branch: string, hasAddress: boolean): string {
  const where = hasAddress ? "publishes to this address" : "publishes it";
  return `Nothing is deployed here yet. The first merge into ${branch} ${where}.`;
}

const TONE_WORDS: Record<HostingTone, string> = {
  ok: "Live",
  pending: "Deploying",
  danger: "Failed",
  idle: "Not deployed",
};

/** The Deployment card's pill: the environment's own status word, or the tone's for Previews. */
export function environmentPillLabel(environment: Pick<HostingEnvironment, "kind" | "preview" | "tone">, previewsKnown: boolean): string {
  if (environment.kind === "previews") return TONE_WORDS[environment.tone];
  const word = environmentStatusWord(environment.preview, previewsKnown);
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}

const DEPLOY_TONES: Readonly<Record<string, HostingTone>> = {
  ready: "ok",
  failed: "danger",
  error: "danger",
  canceled: "danger",
  cancelled: "danger",
  queued: "pending",
  building: "pending",
  initializing: "pending",
};

/**
 * A deploy's dot: ready is success, failed (or a provider's "error") is
 * danger, queued and building are amber. Anything else is not known.
 */
export function deployTone(status: string): HostingTone {
  return DEPLOY_TONES[status.toLowerCase()] ?? "idle";
}

/** The preview branch an environment's variables live under: none for Production. */
export function environmentScopeBranch(
  environment: Pick<HostingEnvironment, "kind" | "branch">,
  previewBranch: string | null,
): string | null {
  if (environment.kind === "production") return null;
  return environment.kind === "previews" ? previewBranch : environment.branch;
}
