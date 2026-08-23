"use client";

import { useEffect, useRef, useState } from "react";

import { adminRepository } from "../../data/admin-repository";
import { NEXT_FEEDBACK_STATUS } from "../../model/admin-rules";
import type {
  AdminStatus,
  FeedbackRecord,
  FeedbackStatus,
} from "../../model/admin-types";

export interface AdminFeedbackViewModel {
  items: FeedbackRecord[];
  status: AdminStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  filter: FeedbackStatus | "all";
  setFilter: (filter: FeedbackStatus | "all") => void;
  /** Id of the record whose triage is in flight, or null. */
  busyId: string | null;
  /** Advances one record to the next status in the triage cycle. */
  advance: (item: FeedbackRecord) => Promise<void>;
  retry: () => void;
}

/** ViewModel for the admin feedback queue. */
export function useAdminFeedbackViewModel(): AdminFeedbackViewModel {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [status, setStatus] = useState<AdminStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [nonce, setNonce] = useState(0);
  const req = useRef(0);

  // As with the user list: the effect resolves, the handlers own the transition
  // into "loading" so no state is set synchronously in an effect body.
  useEffect(() => {
    req.current += 1;
    const id = req.current;
    let active = true;

    adminRepository
      .feedback(filter)
      .then((next) => {
        if (!active || id !== req.current) return;
        setItems(next);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active || id !== req.current) return;
        setError("Could not load feedback.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [filter, nonce]);

  async function advance(item: FeedbackRecord) {
    setBusyId(item.id);
    try {
      await adminRepository.triageFeedback(
        item.id,
        NEXT_FEEDBACK_STATUS[item.status],
      );
      // Re-read rather than patch in place: the active filter may now exclude
      // the record that just moved.
      setNonce((n) => n + 1);
    } finally {
      setBusyId(null);
    }
  }

  return {
    items,
    status,
    error,
    filter,
    setFilter: (next) => {
      setStatus("loading");
      setFilter(next);
    },
    busyId,
    advance,
    retry: () => {
      setStatus("loading");
      setNonce((n) => n + 1);
    },
  };
}
