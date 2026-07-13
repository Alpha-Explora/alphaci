"use client";

import type {
  GroupActivityItem,
  GroupActivityQuery,
  GroupActivityType,
} from "@/lib/api/hierarchy-contracts";
import { timeAgo } from "@/hooks/use-hierarchy";

const ACTIVITY_TYPES: { value: GroupActivityType; label: string }[] = [
  { value: "membership", label: "Membership" },
  { value: "assignment", label: "Assignment" },
  { value: "configuration", label: "Configuration" },
  { value: "github", label: "GitHub" },
];

/**
 * Filter bar for the PM activity/audit feed. Every field maps 1:1 to a
 * GET /groups/:groupId/activity query param (plan §2.8).
 */
export function ActivityFilters({
  value,
  onChange,
}: {
  value: GroupActivityQuery;
  onChange: (next: GroupActivityQuery) => void;
}) {
  function patch(partial: Partial<GroupActivityQuery>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="hier-activity-filters">
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="activity-type">
          Activity type
        </label>
        <select
          id="activity-type"
          className="hier-select"
          value={value.activityType ?? ""}
          onChange={(event) =>
            patch({
              activityType:
                (event.target.value as GroupActivityType) || undefined,
            })
          }
        >
          <option value="">All types</option>
          {ACTIVITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="activity-from">
          From
        </label>
        <input
          id="activity-from"
          type="date"
          className="hier-input"
          value={value.dateFrom ?? ""}
          onChange={(event) =>
            patch({ dateFrom: event.target.value || undefined })
          }
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="activity-to">
          To
        </label>
        <input
          id="activity-to"
          type="date"
          className="hier-input"
          value={value.dateTo ?? ""}
          onChange={(event) =>
            patch({ dateTo: event.target.value || undefined })
          }
        />
      </div>
      <button
        type="button"
        className="hier-btn-sm"
        onClick={() => onChange({})}
        disabled={Object.keys(value).length === 0}
      >
        Clear filters
      </button>
    </div>
  );
}

const TARGET_TONE: Record<GroupActivityItem["targetType"], string> = {
  group: "var(--accent-indigo)",
  system: "var(--accent-violet)",
  delivery_project: "var(--accent-teal)",
  repository: "var(--brand)",
  assignment: "var(--accent-amber)",
  configuration: "var(--accent-purple)",
};

export function ActivityFeed({ items }: { items: GroupActivityItem[] }) {
  return (
    <div className="hier-panel">
      {items.map((item) => (
        <div key={item.id} className="hier-activity-item">
          <div className="hier-activity-rail">
            <span
              className="hier-activity-dot"
              style={{ background: TARGET_TONE[item.targetType] }}
              aria-hidden="true"
            />
          </div>
          <div className="hier-activity-body">
            <p className="hier-activity-msg">{item.message}</p>
            <div className="hier-activity-meta">
              <span>{item.actorLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{timeAgo(item.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span style={{ textTransform: "capitalize" }}>
                {item.targetType.replace(/_/g, " ")}
              </span>
              {item.githubLink && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    className="hier-activity-link"
                    href={item.githubLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View {item.githubLink.type.replace(/_/g, " ")}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
