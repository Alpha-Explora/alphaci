"use client";

import "./qa-report.css";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { ThemeToggle } from "@/shared/layout/theme-toggle";

import { ciRunReportRefFromQuery } from "../../model/ci-run-report-rules";
import { useCiRunReportViewModel, type CiRunReportViewModel } from "../view-models/use-ci-run-report-view-model";
import { CiRunReportDocument } from "./ci-run-report-document";
import { PrinterIcon } from "./report-icons";

function Toolbar({ vm }: Readonly<{ vm: CiRunReportViewModel }>) {
  return (
    <header className="qa-report-toolbar" data-print="hide">
      <div className="qa-report-toolbar__inner">
        <span />
        <div className="qa-report-toolbar__actions">
          <ThemeToggle size="sm" />
          <button type="button" className="qa-report-toolbar__print" disabled={vm.status !== "ready"} onClick={vm.print}>
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
    <div className="qa-report-sheet qa-report-sheet--skeleton" aria-busy="true" aria-label="Loading the CI report">
      <span className="qa-report-skeleton qa-report-skeleton--title" />
      <span className="qa-report-skeleton qa-report-skeleton--meta" />
      <span className="qa-report-skeleton qa-report-skeleton--block" />
      <span className="qa-report-skeleton qa-report-skeleton--table" />
    </div>
  );
}

function ReportError({ vm }: Readonly<{ vm: CiRunReportViewModel }>) {
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

function ReportBody({ vm }: Readonly<{ vm: CiRunReportViewModel }>) {
  if (vm.status === "loading") return <ReportSkeleton />;
  if (vm.status === "error" || !vm.report) return <ReportError vm={vm} />;
  return <CiRunReportDocument report={vm.report} />;
}

function CiRunReportPage() {
  const search = useSearchParams();
  const run = useMemo(() => ciRunReportRefFromQuery(search), [search]);
  const vm = useCiRunReportViewModel({ run, autoPrint: search?.get("print") === "1" });
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
 * The printable CI run report: what failed and how to fix it, then every stage
 * with its figures, without the app shell so the PDF holds the report and
 * nothing else. Which execution comes from the query.
 */
export function CiRunReportView() {
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
      <CiRunReportPage />
    </Suspense>
  );
}
