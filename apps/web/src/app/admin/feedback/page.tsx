"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getAdminFeedback,
  triageAdminFeedback,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@/lib/api/client";

const STATUS_FILTERS: Array<{ value: FeedbackStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const NEXT_STATUS: Record<FeedbackStatus, FeedbackStatus> = {
  open: "in_review",
  in_review: "resolved",
  resolved: "dismissed",
  dismissed: "open",
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: FeedbackStatus | "all") => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getAdminFeedback(status === "all" ? undefined : status));
    } catch {
      setError("Could not load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  async function advance(item: FeedbackRecord) {
    setBusyId(item.id);
    try {
      await triageAdminFeedback(item.id, { status: NEXT_STATUS[item.status] });
      await load(filter);
    } catch {
      setError("Could not update feedback.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Feedback triage">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>Feedback</h1>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={filter === f.value ? "primary-button" : "ghost-button"}
              style={{ padding: "0.35rem 0.85rem", fontSize: "0.8rem" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading feedback…</p>
      ) : error ? (
        <div className="error-inline glass-panel" role="alert" style={{ background: "rgba(248, 113, 113, 0.05)" }}>
          <span className="error-inline-icon" aria-hidden="true">!</span>
          <p className="error-inline-msg">{error}</p>
          <button className="error-retry-btn" type="button" onClick={() => void load(filter)}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No feedback in this view.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {items.map((item) => (
            <article key={item.id} className="glass-panel" style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span className="status-chip status-chip-brand">{item.category}</span>
                  <span style={{ fontWeight: 700 }}>{item.subject}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span className="status-chip status-chip-muted">{item.status}</span>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busyId === item.id}
                    onClick={() => void advance(item)}
                    style={{ padding: "0.35rem 0.85rem", fontSize: "0.78rem" }}
                  >
                    → {NEXT_STATUS[item.status]}
                  </button>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0.75rem 0 0", whiteSpace: "pre-wrap" }}>{item.body}</p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "0.6rem 0 0" }}>
                {item.userLogin ?? item.userId} · {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
