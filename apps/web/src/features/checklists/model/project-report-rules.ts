/* Project QA report rules — reading the server's `qa-report/v2`, naming its
 * files and linking to its print page. Pure: no React, no fetch. */

import {
  QA_PROJECT_REPORT_SCHEMA_VERSION,
  type QaProjectReport,
  type QaProjectReportDefect,
  type QaProjectReportRepository,
} from "./project-report-types";
import type { ProjectQaRun } from "./project-run-types";
import { normalizeProjectRun } from "./project-run-rules";
import { sanitizeFilenamePart } from "./qa-report-rules";
import type { QaReportSignoffEntry, QaReportSummary } from "./qa-report-types";
import { record, records, text } from "./wire-readers";

const RUN_ID_PREFIX_LENGTH = 7;

function repositoryOf(raw: unknown): QaProjectReportRepository | null {
  const value = record(raw);
  const projectId = text(value?.projectId);
  const repoFullName = text(value?.repoFullName);
  if (!value || !projectId || !repoFullName) return null;
  return {
    projectId,
    repoFullName,
    name: text(value.name) ?? (repoFullName.split("/").pop() || repoFullName),
    headSha: text(value.headSha),
  };
}

function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function repositoriesOf(value: unknown): QaProjectReportRepository[] {
  return records(value)
    .map(repositoryOf)
    .filter((repository): repository is QaProjectReportRepository => repository !== null);
}

/** The report's project, or the run's own when the report names none. */
function projectOf(value: unknown, run: ProjectQaRun): QaProjectReport["project"] {
  const project = record(value);
  return { id: text(project?.id) ?? run.deliveryProjectId, name: text(project?.name) ?? run.deliveryProjectName };
}

/**
 * The report as the server sent it, with the run read through the Project run
 * reader so its per-repository results and items have their normal shape.
 * Null when there is no run or summary to draw: the page then says so.
 */
export function normalizeProjectReport(value: unknown): QaProjectReport | null {
  const raw = record(value);
  const run = normalizeProjectRun(raw?.run);
  const summary = record(raw?.summary);
  if (!raw || !run || !summary) return null;
  return {
    schemaVersion: QA_PROJECT_REPORT_SCHEMA_VERSION,
    generatedAt: text(raw.generatedAt) ?? "",
    frozen: raw.frozen === true,
    project: projectOf(raw.project, run),
    repositories: repositoriesOf(raw.repositories),
    run,
    summary: summary as unknown as QaReportSummary,
    defects: listOf<QaProjectReportDefect>(raw.defects),
    signoffHistory: listOf<QaReportSignoffEntry>(raw.signoffHistory),
  };
}

/**
 * "QA-Report-logistics-a1b2c3d" — no extension. The backend names its download
 * the same way (project name, first seven of the run id), so a report saves
 * under one name whichever side produced it.
 */
export function projectReportBaseName(report: Pick<QaProjectReport, "project" | "run">): string {
  const project = sanitizeFilenamePart(report.project.name);
  const run = sanitizeFilenamePart(report.run.id.slice(0, RUN_ID_PREFIX_LENGTH));
  return `QA-Report-${project}-${run}`;
}

export function projectReportFilename(
  report: Pick<QaProjectReport, "project" | "run">,
  extension: "json" | "md" | "pdf" | "xlsx",
): string {
  return `${projectReportBaseName(report)}.${extension}`;
}

/** The printable Project report page. `print` asks it to open the print dialog once. */
export function projectReportPageHref(
  deliveryProjectId: string,
  runId: string,
  options: { print?: boolean } = {},
): string {
  const path = `/qa/project-report/${encodeURIComponent(deliveryProjectId)}/${encodeURIComponent(runId)}`;
  return options.print ? `${path}?print=1` : path;
}

/** One covered repository with the head it captured, "logistics2cicd-fe @ 708e8d3". */
export function repositoryHeadLabel(repository: Pick<QaProjectReportRepository, "name" | "headSha">): string {
  return repository.headSha ? `${repository.name} @ ${repository.headSha.slice(0, RUN_ID_PREFIX_LENGTH)}` : repository.name;
}
