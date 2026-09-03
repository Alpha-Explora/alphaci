"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { ProjectStatus } from "../../model/projects-types";
import { projectQueryStatus } from "../model/project-detail-tab-rules";

export interface LazyProjectQuery<T> {
  data: T | null;
  error: string | null;
  status: ProjectStatus;
  replace: (next: T) => void;
  fail: (message: string) => void;
  clearError: () => void;
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Lazy per-project read. Skips while `enabled` is false and does not refetch
 * after a successful load for the same project id (tab switches keep the cache).
 *
 * State updates happen in promise callbacks or handlers — never synchronously
 * inside the effect body.
 */
export function useLazyProjectQuery<T>(options: {
  projectId: string;
  enabled: boolean;
  load: (projectId: string) => Promise<T>;
  errorMessage: string;
}): LazyProjectQuery<T> {
  const { projectId, enabled, load, errorMessage } = options;

  const [data, setData] = useState<T | null>(null);
  const [dataProjectId, setDataProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorProjectId, setErrorProjectId] = useState<string | null>(null);

  const loadedForId = useRef<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    if (!enabled || !projectId) return;
    if (loadedForId.current === projectId) return;

    req.current += 1;
    const id = req.current;
    let active = true;

    load(projectId)
      .then((response) => {
        if (!active || id !== req.current) return;
        loadedForId.current = projectId;
        setData(response);
        setDataProjectId(projectId);
        setError(null);
        setErrorProjectId(null);
      })
      .catch(() => {
        if (!active || id !== req.current) return;
        setError(errorMessage);
        setErrorProjectId(projectId);
      });

    return () => {
      active = false;
    };
  }, [enabled, errorMessage, load, projectId]);

  const selectedData = dataProjectId === projectId ? data : null;
  const selectedError = errorProjectId === projectId ? error : null;

  function replace(next: T) {
    loadedForId.current = projectId;
    setData(next);
    setDataProjectId(projectId);
    setError(null);
    setErrorProjectId(null);
  }

  function fail(message: string) {
    setError(message);
    setErrorProjectId(projectId);
  }

  function clearError() {
    setError(null);
    setErrorProjectId(null);
  }

  return {
    data: selectedData,
    error: selectedError,
    status: projectQueryStatus(selectedData !== null, selectedError),
    replace,
    fail,
    clearError,
    setData,
  };
}
