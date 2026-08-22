"use client";

import { useEffect, useRef, useState } from "react";

import { adminRepository } from "../../data/admin-repository";
import type { AdminStatus, AdminUsersPage } from "../../model/admin-types";

export interface AdminUsersViewModel {
  page: AdminUsersPage | null;
  status: AdminStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** The text in the search box, which is not the applied term. */
  search: string;
  setSearch: (search: string) => void;
  /** Applies the current box contents. */
  submitSearch: () => void;
  retry: () => void;
}

/** ViewModel for the admin user list. */
export function useAdminUsersViewModel(): AdminUsersViewModel {
  const [page, setPage] = useState<AdminUsersPage | null>(null);
  const [status, setStatus] = useState<AdminStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");

  const [nonce, setNonce] = useState(0);
  // Bumped per request so a slow earlier search cannot overwrite a newer one.
  const req = useRef(0);

  // The effect only resolves the request. The transition into "loading" happens
  // in the handlers below, which are events rather than effect bodies — that is
  // what keeps this out of the cascading-render pattern the lint rule forbids.
  useEffect(() => {
    req.current += 1;
    const id = req.current;
    let active = true;

    adminRepository
      .users(applied)
      .then((next) => {
        if (!active || id !== req.current) return;
        setPage(next);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active || id !== req.current) return;
        setError("Could not load users.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [applied, nonce]);

  return {
    page,
    status,
    error,
    search,
    setSearch,
    submitSearch: () => {
      setStatus("loading");
      setApplied(search.trim());
    },
    retry: () => {
      setStatus("loading");
      setNonce((n) => n + 1);
    },
  };
}
