"use client";

import {
  FEEDBACK_STATUS_FILTERS,
  NEXT_FEEDBACK_STATUS,
} from "../../model/admin-rules";
import { useAdminFeedbackViewModel } from "../view-models/use-admin-feedback-view-model";

/** Public view for the admin feedback queue. */
export function AdminFeedbackView() {
  const vm = useAdminFeedbackViewModel();

  // Aliases onto the view-model; the markup below is the route's, moved.
  const items = vm.items;
  const loading = vm.status === "loading";
  const error = vm.error;
  const filter = vm.filter;
  const setFilter = vm.setFilter;
  const busyId = vm.busyId;
  const load = (_status?: typeof filter) => vm.retry();
  const advance = (item: (typeof items)[number]) => void vm.advance(item);
  const NEXT_STATUS = NEXT_FEEDBACK_STATUS;
  const STATUS_FILTERS = FEEDBACK_STATUS_FILTERS;

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

