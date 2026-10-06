"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProjectStatus } from "../../model/projects-types";
import {
  addProjectBrowserTests,
  getProjectBrowserTests,
} from "../data/project-browser-tests-api";
import {
  browserTestsError,
  type BrowserTestsAdded,
  type BrowserTestsError,
  type BrowserTestsStatus,
} from "../model/browser-test-rules";

export interface BrowserTestsViewModel {
  /** The status read. "error" leaves the card hidden: it is an offer, not a report. */
  status: ProjectStatus;
  browserTests: BrowserTestsStatus | null;
  /** True while the pull request is being opened. */
  adding: boolean;
  added: BrowserTestsAdded | null;
  addError: BrowserTestsError | null;
  add: () => void;
}

/**
 * The project's "Add browser tests" card: read once when the Pipeline runs
 * tab opens, never polled — the pack changes only when someone merges it.
 *
 * The add is a handler, so it owns its own pending flag; the read's `status`
 * is the one status here. A role refused by the server keeps its refusal on
 * screen and loses the button, rather than offering it again.
 */
export function useBrowserTestsViewModel(options: { projectId: string }): BrowserTestsViewModel {
  const { projectId } = options;
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [browserTests, setBrowserTests] = useState<BrowserTestsStatus | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<BrowserTestsAdded | null>(null);
  const [addError, setAddError] = useState<BrowserTestsError | null>(null);
  const ticket = useRef(0);

  useEffect(() => {
    const mine = ++ticket.current;
    getProjectBrowserTests(projectId)
      .then((result) => {
        if (mine !== ticket.current) return;
        setBrowserTests(result);
        setStatus("ready");
      })
      .catch(() => {
        if (mine !== ticket.current) return;
        setStatus("error");
      });
  }, [projectId]);

  const add = useCallback(() => {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    addProjectBrowserTests(projectId)
      .then((result) => setAdded(result))
      .catch((cause: unknown) => {
        const failure = browserTestsError(cause, projectId);
        setAddError(failure);
        if (failure.kind === "forbidden") {
          setBrowserTests((current) => (current ? { ...current, canAdd: false } : current));
        }
      })
      .finally(() => setAdding(false));
  }, [adding, projectId]);

  return { status, browserTests, adding, added, addError, add };
}
