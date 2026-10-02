import {
  appendAuditPage,
  auditActorLabel,
  auditEmptyMessage,
  auditEventLabel,
  auditRelativeTime,
  normalizeAuditPage,
} from "../../../../../../src/features/projects/detail/model/audit-event-rules";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");

function wire(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    eventCode: "pull_request_merged",
    message: "Merged pull request #12 into dev.",
    actorUserId: "u-1",
    actorLogin: "ana",
    metadata: {},
    createdAt: "2026-10-02T11:55:00.123456+00:00",
    scope: "repository",
    ...overrides,
  };
}

describe("auditEventLabel", () => {
  it.each([
    ["project_created", "Repository created"],
    ["deployment_target_created", "Hosting service added"],
    ["deployment_target_failed", "Hosting service setup failed"],
    ["env_vars_provisioned", "Environment variables set"],
    ["project_github_repo_deleted", "GitHub repository deleted"],
    ["project_sonar_project_deleted", "SonarCloud project deleted"],
    ["deployment_provider_resources_deleted", "Hosting resources deleted"],
    ["pull_request_created", "Pull request opened"],
    ["pull_request_merged", "Pull request merged"],
    ["workflow_pr_created", "Workflow update pull request opened"],
    ["qa.run.created", "QA run started"],
    ["qa.item.status_changed", "QA item status changed"],
    ["qa.automation.dispatched", "Automated tests started"],
    ["qa.promotion.merged", "Merged to main"],
    ["qa.requirement.created", "Requirement added"],
    ["qa.requirement.updated", "Requirement updated"],
    ["qa.requirement.archived", "Requirement archived"],
    ["qa.requirement.progress_changed", "Requirement progress changed"],
    ["qa.checklist.shared", "Checklist shared"],
    ["hierarchy.delivery_project.created", "Project created"],
  ])("labels %s", (code, label) => {
    expect(auditEventLabel(code, "server text")).toBe(label);
  });

  it("labels an unknown code of a known family by its family", () => {
    expect(auditEventLabel("qa.checklist.renamed", "x")).toBe("Checklist changed");
    expect(auditEventLabel("hierarchy.delivery_project.restored", "x")).toBe("Project changed");
  });

  it("falls back to the server's message, then to the code in words", () => {
    expect(auditEventLabel("billing_plan_changed", "Plan changed to Team.")).toBe("Plan changed to Team.");
    expect(auditEventLabel("billing_plan_changed", "  ")).toBe("Billing plan changed");
    expect(auditEventLabel("billing_plan_changed", null)).toBe("Billing plan changed");
  });
});

describe("auditActorLabel", () => {
  it("shows the login, else System", () => {
    expect(auditActorLabel("ana")).toBe("ana");
    expect(auditActorLabel(null)).toBe("System");
    expect(auditActorLabel(undefined)).toBe("System");
    expect(auditActorLabel(" ")).toBe("System");
  });
});

describe("auditRelativeTime", () => {
  it.each([
    ["2026-10-02T11:59:40.000Z", "just now"],
    ["2026-10-02T11:55:00.123456+00:00", "4m ago"],
    ["2026-10-02T09:00:00.000Z", "3h ago"],
    ["2026-09-29T12:00:00.000Z", "3d ago"],
    ["not a date", ""],
  ])("%s -> %p", (iso, expected) => {
    expect(auditRelativeTime(iso, NOW)).toBe(expected);
  });
});

describe("normalizeAuditPage", () => {
  it("reads a full page", () => {
    const page = normalizeAuditPage({ enabled: true, items: [wire()], next: "2026-10-02T11:55:00.123456+00:00" });
    expect(page.enabled).toBe(true);
    expect(page.next).toBe("2026-10-02T11:55:00.123456+00:00");
    expect(page.items).toEqual([
      {
        id: "ev-1",
        eventCode: "pull_request_merged",
        label: "Pull request merged",
        detail: "Merged pull request #12 into dev.",
        actor: "ana",
        createdAt: "2026-10-02T11:55:00.123456+00:00",
        scope: "repository",
        restored: false,
      },
    ]);
  });

  it("tags Project-scoped and restored rows", () => {
    const [row] = normalizeAuditPage({
      enabled: true,
      items: [wire({ scope: "project", eventCode: "qa.requirement.created", metadata: { backfilledFromOutbox: true } })],
    }).items;
    expect(row.scope).toBe("project");
    expect(row.restored).toBe(true);
  });

  it("degrades an older backend's row: no login is System, no scope is the repository, no next is the last page", () => {
    const page = normalizeAuditPage({
      enabled: true,
      items: [{ id: "ev-2", eventCode: "project_created", message: "Repository created", actorUserId: null, createdAt: "2026-10-01T00:00:00Z" }],
    });
    expect(page.next).toBeNull();
    expect(page.items[0]).toMatchObject({ actor: "System", scope: "repository", restored: false });
    // The message only repeats the label, so it is not shown twice.
    expect(page.items[0].detail).toBeNull();
  });

  it("drops malformed rows and survives junk", () => {
    expect(normalizeAuditPage({ enabled: true, items: [{ id: "x" }, null, 3, wire()] }).items).toHaveLength(1);
    expect(normalizeAuditPage(null)).toEqual({ enabled: true, items: [], next: null });
    expect(normalizeAuditPage({ items: "nope" }).items).toEqual([]);
  });

  it("reads recording off only from an explicit false", () => {
    expect(normalizeAuditPage({ enabled: false, items: [] }).enabled).toBe(false);
    expect(normalizeAuditPage({ items: [] }).enabled).toBe(true);
  });
});

describe("appendAuditPage", () => {
  it("adds older rows after the shown ones, skipping repeats, and moves the cursor", () => {
    const first = normalizeAuditPage({ enabled: true, items: [wire({ id: "a" }), wire({ id: "b" })], next: "c1" });
    const second = normalizeAuditPage({ enabled: true, items: [wire({ id: "b" }), wire({ id: "c" })], next: null });
    const merged = appendAuditPage(first, second);
    expect(merged.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(merged.next).toBeNull();
  });
});

describe("auditEmptyMessage", () => {
  it("says whether recording is off or there is simply nothing yet", () => {
    expect(auditEmptyMessage(false)).toBe("Audit recording is turned off for this deployment.");
    expect(auditEmptyMessage(true)).toBe("No activity recorded yet.");
  });
});
