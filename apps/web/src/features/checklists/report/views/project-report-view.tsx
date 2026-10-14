"use client";

import "./qa-report.css";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState, type ReactNode } from "react";

import { ThemeToggle } from "@/shared/layout/theme-toggle";

import {
  useProjectReportViewModel,
  type ProjectReportViewModel,
} from "../view-models/use-project-report-view-model";
import type { QaProjectReportRepository } from "../../model/project-report-types";
import { useAutoPrint } from "../view-models/use-qa-report-view-model";
import {
  useReportEvidenceViewModel,
  type ReportEvidenceViewModel,
} from "../view-models/use-report-evidence-view-model";
import { ProjectQaReportDocument, type RenderVisualEvidence } from "./project-report-document";
import { ReportItemEvidence } from "./project-report-evidence";
import { PrinterIcon } from "./report-icons";

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function Toolbar({ vm }: Readonly<{ vm: ProjectReportViewModel }>) {
  return (
    <header className="qa-report-toolbar" data-print="hide">
      <div className="qa-report-toolbar__inner">
        <span />
        <div className="qa-report-toolbar__actions">
          <ThemeToggle size="sm" />
          <button
            type="button"
            className="qa-report-toolbar__print"
            disabled={vm.status !== "ready"}
            onClick={vm.print}
          >
            <PrinterIcon />
            Print / Save as PDF
          </button>
        </div>
      </div>
    </header>
  );
}

function ReportSkeleton() {
  return (
    <div className="qa-report-sheet qa-report-sheet--skeleton" aria-busy="true" aria-label="Loading the QA report">
      <span className="qa-report-skeleton qa-report-skeleton--title" />
      <span className="qa-report-skeleton qa-report-skeleton--meta" />
      <span className="qa-report-skeleton qa-report-skeleton--block" />
      <span className="qa-report-skeleton qa-report-skeleton--table" />
    </div>
  );
}

function ReportError({ vm }: Readonly<{ vm: ProjectReportViewModel }>) {
  const error = vm.error;
  if (!error) return null;
  return (
    <div className="qa-report-sheet qa-report-state" role="alert">
      <h1 className="qa-report-state__title">{error.title}</h1>
      <p className="qa-report-state__text">{error.text}</p>
      {error.signIn ? (
        <a className="qa-report-toolbar__print" href="/login">
          Sign in
        </a>
      ) : (
        <button type="button" className="qa-report-toolbar__print" onClick={vm.reload}>
          Try again
        </button>
      )}
    </div>
  );
}

function ReportBody({
  vm,
  evidence,
  renderVisualEvidence,
}: Readonly<{
  vm: ProjectReportViewModel;
  evidence: ReportEvidenceViewModel;
  renderVisualEvidence?: RenderVisualEvidence;
}>) {
  if (vm.status === "loading") return <ReportSkeleton />;
  if (vm.status === "error" || !vm.report) return <ReportError vm={vm} />;
  return (
    <ProjectQaReportDocument
      report={vm.report}
      renderVisualEvidence={renderVisualEvidence}
      renderItemEvidence={(item) => <ReportItemEvidence item={item} vm={evidence} />}
    />
  );
}

/** What the host hands the page to draw each repository's screenshots, and to say when they are in. */
export type RenderRepositoryEvidence = (
  repository: QaProjectReportRepository,
  controls: { onSettled: () => void },
) => ReactNode;

function ProjectQaReportPage({ renderEvidence }: Readonly<{ renderEvidence?: RenderRepositoryEvidence }>) {
  const params = useParams<{ deliveryProjectId: string; runId: string }>();
  const search = useSearchParams();
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());
  const settle = useCallback(
    (projectId: string) =>
      setSettled((previous) => (previous.has(projectId) ? previous : new Set(previous).add(projectId))),
    [],
  );
  const deliveryProjectId = param(params?.deliveryProjectId);
  const runId = param(params?.runId);
  const vm = useProjectReportViewModel({ deliveryProjectId, runId, autoPrint: false });
  const itemEvidence = useReportEvidenceViewModel({ deliveryProjectId, runId, report: vm.report });
  // The print dialog waits for the screenshots: printing before they load would
  // put empty frames in the PDF.
  const evidenceIn =
    !renderEvidence || (vm.report !== null && vm.report.repositories.every((r) => settled.has(r.projectId)));
  // ...and so does each item's own evidence.
  useAutoPrint(search?.get("print") === "1" && vm.status === "ready" && evidenceIn && itemEvidence.settled);
  const renderVisualEvidence: RenderVisualEvidence | undefined = renderEvidence
    ? (repository) => renderEvidence(repository, { onSettled: () => settle(repository.projectId) })
    : undefined;
  return (
    <div className="qa-report-page">
      <Toolbar vm={vm} />
      <main className="qa-report-page__main">
        <ReportBody vm={vm} evidence={itemEvidence} renderVisualEvidence={renderVisualEvidence} />
      </main>
    </div>
  );
}

/**
 * The printable Project QA report: the same fixed template as a repository's
 * report, without the app shell, so the PDF holds the report and nothing else.
 */
export function ProjectQaReportView({ renderEvidence }: Readonly<{ renderEvidence?: RenderRepositoryEvidence }>) {
  return (
    <Suspense
      fallback={
        <div className="qa-report-page">
          <main className="qa-report-page__main">
            <ReportSkeleton />
          </main>
        </div>
      }
    >
      <ProjectQaReportPage renderEvidence={renderEvidence} />
    </Suspense>
  );
}
