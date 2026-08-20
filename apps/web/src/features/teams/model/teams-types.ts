/* Domain types for the teams feature.
 *
 * One workspace IS one team, so a "team" here is a GroupSummary. The wire
 * shapes still live in lib/api, shared with the unmigrated verticals;
 * re-exporting through this file gives the slice one type surface, so when
 * those contracts are decomposed per-domain only this file changes. */
export type { GroupSummary as Team } from "@/lib/api/hierarchy-contracts";
export type { ProvisionedProject } from "@/lib/api/contracts";

/** Lifecycle of the team detail surface, as the view-model reports it. */
export type TeamsStatus = "idle" | "loading" | "ready" | "error";
