"use client";

import "./qa-report.css";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ThemeToggle } from "@/shared/layout/theme-toggle";

import {
  useProjectReportViewModel,
  type ProjectReportViewModel,
} from "../view-models/use-project-report-view-model";
import { ProjectQaReportDocument } from "./project-report-document";
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

function ReportBody({ vm }: Readonly<{ vm: ProjectReportViewModel }>) {
  if (vm.status === "loading") return <ReportSkeleton />;
  if (vm.status === "error" || !vm.report) return <ReportError vm={vm} />;
  return <ProjectQaReportDocument report={vm.report} />;
}

function ProjectQaReportPage() {
  const params = useParams<{ deliveryProjectId: string; runId: string }>();
  const search = useSearchParams();
  const vm = useProjectReportViewModel({
    deliveryProjectId: param(params?.deliveryProjectId),
    runId: param(params?.runId),
    autoPrint: search?.get("print") === "1",
  });
  return (
    <div className="qa-report-page">
      <Toolbar vm={vm} />
      <main className="qa-report-page__main">
        <ReportBody vm={vm} />
      </main>
    </div>
  );
}

/**
 * The printable Project QA report: the same fixed template as a repository's
 * report, without the app shell, so the PDF holds the report and nothing else.
 */
export function ProjectQaReportView() {
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
      <ProjectQaReportPage />
    </Suspense>
  );
}
