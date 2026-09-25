"use client";

import "./qa-report.css";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ThemeToggle } from "@/shared/layout/theme-toggle";

import { qaStudioHref } from "../../model/qa-report-rules";
import { useQaReportViewModel, type QaReportViewModel } from "../view-models/use-qa-report-view-model";
import { QaReportDocument } from "./qa-report-document";
import { ArrowLeftIcon, PrinterIcon } from "./report-icons";

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function Toolbar({ projectId, vm }: Readonly<{ projectId: string; vm: QaReportViewModel }>) {
  return (
    <header className="qa-report-toolbar" data-print="hide">
      <div className="qa-report-toolbar__inner">
        <Link className="qa-report-toolbar__back" href={qaStudioHref(projectId)}>
          <ArrowLeftIcon />
          Back to QA Studio
        </Link>
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

function ReportError({ vm }: Readonly<{ vm: QaReportViewModel }>) {
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

function ReportBody({ vm }: Readonly<{ vm: QaReportViewModel }>) {
  if (vm.status === "loading") return <ReportSkeleton />;
  if (vm.status === "error" || !vm.report) return <ReportError vm={vm} />;
  return <QaReportDocument report={vm.report} />;
}

function QaReportPage() {
  const params = useParams<{ projectId: string; runId: string }>();
  const search = useSearchParams();
  const projectId = param(params?.projectId);
  const vm = useQaReportViewModel({
    projectId,
    runId: param(params?.runId),
    autoPrint: search?.get("print") === "1",
  });
  return (
    <div className="qa-report-page">
      <Toolbar projectId={projectId} vm={vm} />
      <main className="qa-report-page__main">
        <ReportBody vm={vm} />
      </main>
    </div>
  );
}

/**
 * The printable QA report: one fixed enterprise template, rendered without the
 * app shell so the PDF holds the report and nothing else. On screen it follows
 * the app theme; under print it switches to paper and ink.
 */
export function QaReportView() {
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
      <QaReportPage />
    </Suspense>
  );
}
