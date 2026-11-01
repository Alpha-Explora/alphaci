import { request } from "@/shared/api/request";

import {
  normalizeProgressResult,
  normalizeProjectRequirements,
  normalizeRequirement,
  normalizeRequirementItem,
  requirementCountsByProject,
} from "../model/requirement-rules";
import { normalizeTeamQaOverview } from "../model/team-qa-overview-rules";
import type { TeamQaOverview } from "../model/team-qa-overview-types";
import { records, record } from "../model/wire-readers";
import type {
  CreateRequirementBatchInput,
  CreateRequirementInput,
  ProjectRequirements,
  Requirement,
  RequirementItem,
  RequirementItemInput,
  SetProgressInput,
  SetProgressResult,
  UpdateRequirementInput,
  UpdateRequirementItemInput,
} from "../model/requirement-types";

/* The only place in the checklists domain that talks to the Project
 * requirement endpoints. Every reply is normalised here, so nothing above
 * this file sees a raw wire object.
 *
 * Edits go by item id and never replace the item list wholesale: the legacy
 * PUT /qa-checklists/:id/items deletes and reinserts, which would wipe every
 * item's Progress. Every write carries the version (requirement) or row
 * version (item) the caller read, so two people editing get a 409 instead of
 * silently overwriting each other. */

const enc = encodeURIComponent;

function send(method: "POST" | "PATCH" | "PUT", body?: unknown): RequestInit {
  return body === undefined ? { method } : { method, body: JSON.stringify(body) };
}

/** A reply that should be a requirement; a body that is not one is an error. */
function requirementOrThrow(value: unknown): Requirement {
  const requirement = normalizeRequirement(value);
  if (!requirement) throw new Error("The server did not return the requirement.");
  return requirement;
}

/** A batch reply: the created requirements in request order; none readable is an error. */
function requirementsOrThrow(value: unknown): Requirement[] {
  const created = records(record(value)?.requirements)
    .map(normalizeRequirement)
    .filter((requirement): requirement is Requirement => requirement !== null);
  if (created.length === 0) throw new Error("The server did not return the requirements.");
  return created;
}

function itemOrThrow(value: unknown, requirementId: string): RequirementItem {
  const item = normalizeRequirementItem(value, requirementId);
  if (!item) throw new Error("The server did not return the item.");
  return item;
}

export const requirementsRepository = {
  async listForProject(deliveryProjectId: string): Promise<ProjectRequirements> {
    const raw = await request<unknown>(`/delivery-projects/${enc(deliveryProjectId)}/requirements`);
    return normalizeProjectRequirements(raw);
  },

  async create(deliveryProjectId: string, input: CreateRequirementInput): Promise<Requirement> {
    const raw = await request<unknown>(
      `/delivery-projects/${enc(deliveryProjectId)}/requirements`,
      send("POST", input),
    );
    return requirementOrThrow(raw);
  },

  /** Several requirements of one kind in ONE request: all are created, or none. */
  async createBatch(deliveryProjectId: string, input: CreateRequirementBatchInput): Promise<Requirement[]> {
    const raw = await request<unknown>(
      `/delivery-projects/${enc(deliveryProjectId)}/requirements/batch`,
      send("POST", input),
    );
    return requirementsOrThrow(raw);
  },

  async update(requirementId: string, input: UpdateRequirementInput): Promise<Requirement> {
    const raw = await request<unknown>(`/requirements/${enc(requirementId)}`, send("PATCH", input));
    return requirementOrThrow(raw);
  },

  async archive(requirementId: string): Promise<Requirement> {
    const raw = await request<unknown>(`/requirements/${enc(requirementId)}/archive`, send("POST"));
    return requirementOrThrow(raw);
  },

  async addItem(requirementId: string, input: RequirementItemInput): Promise<RequirementItem> {
    const raw = await request<unknown>(`/requirements/${enc(requirementId)}/items`, send("POST", input));
    return itemOrThrow(raw, requirementId);
  },

  async updateItem(
    requirementId: string,
    itemId: string,
    input: UpdateRequirementItemInput,
  ): Promise<RequirementItem> {
    const raw = await request<unknown>(
      `/requirements/${enc(requirementId)}/items/${enc(itemId)}`,
      send("PATCH", input),
    );
    return itemOrThrow(raw, requirementId);
  },

  async deleteItem(requirementId: string, itemId: string): Promise<void> {
    await request<unknown>(`/requirements/${enc(requirementId)}/items/${enc(itemId)}`, { method: "DELETE" });
  },

  /** Exactly the current set of ids, in the new order. Returns nothing the caller needs. */
  async reorderItems(requirementId: string, itemIds: string[]): Promise<void> {
    await request<unknown>(`/requirements/${enc(requirementId)}/items/order`, send("PUT", { itemIds }));
  },

  /** Developer, Product owner or admin. `previous` stands in if the reply has no item. */
  async setProgress(previous: RequirementItem, input: SetProgressInput): Promise<SetProgressResult> {
    const raw = await request<unknown>(
      `/requirements/${enc(previous.requirementId)}/items/${enc(previous.id)}/progress`,
      send("PATCH", input),
    );
    return normalizeProgressResult(raw, previous);
  },

  /** How many live requirements each of the team's Projects has (the team overview, reduced). */
  async countsByProject(workspaceId: string): Promise<Record<string, number>> {
    const raw = await request<unknown>(`/workspaces/${enc(workspaceId)}/qa-requirements/overview`);
    return requirementCountsByProject(raw);
  },

  /** The team overview, whole: every Project with its requirements, newest run, counts and promotion. */
  async teamOverview(workspaceId: string): Promise<TeamQaOverview> {
    const raw = await request<unknown>(`/workspaces/${enc(workspaceId)}/qa-requirements/overview`);
    return normalizeTeamQaOverview(raw);
  },
};
