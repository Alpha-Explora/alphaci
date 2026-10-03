import {
  appendAuditPage,
  auditActorLabel,
  auditEmptyMessage,
  auditEventLabel,
  auditFilterEmptyMessage,
  auditPushCommits,
  auditRelativeTime,
  auditSyncButtonLabel,
  auditSyncLine,
  filterAuditRows,
  githubEventLabel,
  normalizeAuditPage,
  normalizeGithubSync,
  pushCommitsToggleLabel,
  showAuditFilters,
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
        commits: [],
        moreCommits: 0,
      },
    ]);
    expect(page.githubSync).toBeNull();
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
    expect(normalizeAuditPage(null)).toEqual({ enabled: true, items: [], next: null, githubSync: null });
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

describe("githubEventLabel", () => {
  it.each([
    ["github.push", { branch: "dev", size: 3 }, "Pushed 3 commits to dev"],
    ["github.push", { branch: "dev", size: 1 }, "Pushed 1 commit to dev"],
    ["github.push", { branch: "uat", size: 2, forced: true }, "Force-pushed 2 commits to uat"],
    ["github.push", { branch: "main", size: 0, forced: true }, "Force-pushed to main"],
    ["github.push", { branch: "dev", commits: [{ sha: "a".repeat(40), message: "x" }] }, "Pushed 1 commit to dev"],
    ["github.push", {}, "Pushed"],
    ["github.pull_request.opened", { number: 12, title: "Add checkout" }, "Opened pull request #12: Add checkout"],
    ["github.pull_request.opened", { number: 12 }, "Opened pull request #12"],
    ["github.pull_request.merged", { number: 12, base: "uat" }, "Merged pull request #12 into uat"],
    ["github.pull_request.merged", {}, "Merged a pull request"],
    ["github.pull_request.closed", { number: 12 }, "Closed pull request #12"],
    ["github.pull_request.reopened", { number: 12 }, "Reopened pull request #12"],
    ["github.pull_request.reviewed", { number: 12, state: "approved" }, "Reviewed pull request #12 (approved)"],
    ["github.pull_request.reviewed", { number: 12, state: "CHANGES_REQUESTED" }, "Reviewed pull request #12 (changes requested)"],
    ["github.pull_request.reviewed", { number: 12 }, "Reviewed pull request #12"],
    ["github.branch.created", { branch: "feature/x" }, "Created branch feature/x"],
    ["github.branch.deleted", { ref: "refs/heads/feature/x" }, "Deleted branch feature/x"],
    ["github.branch.created", {}, "Created branch"],
    ["github.tag.created", { tag: "v1.2.0" }, "Created tag v1.2.0"],
    ["github.tag.deleted", { ref: "refs/tags/v1.2.0" }, "Deleted tag v1.2.0"],
  ])("%s %j -> %s", (code, metadata, label) => {
    expect(githubEventLabel(code, metadata)).toBe(label);
  });

  it("is null for a code that is not a known GitHub one", () => {
    expect(githubEventLabel("pull_request_merged", {})).toBeNull();
    expect(githubEventLabel("github.release.published", {})).toBeNull();
    expect(githubEventLabel("github.push", null)).toBe("Pushed");
  });

  it("gives an unknown github code a family label", () => {
    expect(auditEventLabel("github.pull_request.labeled", null)).toBe("Pull request activity on GitHub");
    expect(auditEventLabel("github.release.published", null)).toBe("GitHub activity");
  });
});

describe("auditPushCommits", () => {
  it("reads the listed commits, dropping ones without a SHA", () => {
    expect(
      auditPushCommits({
        commits: [
          { sha: "a".repeat(40), message: "Add checkout\n\nbody", authorName: "Ana" },
          { message: "no sha" },
          "junk",
        ],
      }),
    ).toEqual([{ sha: "a".repeat(40), shortSha: "aaaaaaa", title: "Add checkout" }]);
    expect(auditPushCommits({ commits: "nope" })).toEqual([]);
    expect(auditPushCommits({})).toEqual([]);
  });
});

describe("normalizeAuditPage: GitHub activity", () => {
  it("labels a push from its metadata, takes the GitHub login, lists its commits and counts the unlisted", () => {
    const [row] = normalizeAuditPage({
      enabled: true,
      items: [
        wire({
          eventCode: "github.push",
          message: "ana pushed to dev",
          actorLogin: null,
          scope: "github",
          metadata: {
            branch: "dev",
            size: 3,
            forced: false,
            githubLogin: "ana-gh",
            commits: [
              { sha: "a".repeat(40), message: "One" },
              { sha: "b".repeat(40), message: "Two" },
            ],
          },
        }),
      ],
    }).items;
    expect(row).toMatchObject({
      label: "Pushed 3 commits to dev",
      detail: null,
      actor: "ana-gh",
      scope: "github",
      moreCommits: 1,
    });
    expect(row.commits.map((commit) => commit.title)).toEqual(["One", "Two"]);
  });

  it("prefers actorLogin over metadata.githubLogin", () => {
    const [row] = normalizeAuditPage({
      enabled: true,
      items: [wire({ eventCode: "github.pull_request.opened", scope: "github", metadata: { number: 4, githubLogin: "other" } })],
    }).items;
    expect(row.actor).toBe("ana");
    expect(row.commits).toEqual([]);
  });

  it("reads an unscoped github.* row as GitHub's, and an unknown scope as the repository", () => {
    const page = normalizeAuditPage({
      enabled: true,
      items: [
        wire({ id: "a", eventCode: "github.branch.created", scope: undefined, metadata: { branch: "x" } }),
        wire({ id: "b", scope: "mystery" }),
      ],
    });
    expect(page.items.map((row) => row.scope)).toEqual(["github", "repository"]);
  });

  it("reads githubSync, and drops one it cannot read", () => {
    expect(normalizeGithubSync({ status: "ok", syncedAt: "2026-10-02T11:58:00Z" })).toEqual({ status: "ok", syncedAt: "2026-10-02T11:58:00Z" });
    expect(normalizeGithubSync({ status: "failed" })).toEqual({ status: "failed", syncedAt: null });
    expect(normalizeGithubSync({ status: "weird" })).toBeNull();
    expect(normalizeGithubSync(null)).toBeNull();
    expect(normalizeAuditPage({ enabled: true, items: [], githubSync: { status: "stale", syncedAt: null } }).githubSync).toEqual({
      status: "stale",
      syncedAt: null,
    });
  });

  it("keeps the first page's sync state when an older page has none", () => {
    const first = normalizeAuditPage({ enabled: true, items: [wire({ id: "a" })], next: "c", githubSync: { status: "ok", syncedAt: null } });
    const second = normalizeAuditPage({ enabled: true, items: [wire({ id: "b" })], next: null });
    expect(appendAuditPage(first, second).githubSync).toEqual({ status: "ok", syncedAt: null });
  });
});

describe("auditSyncLine", () => {
  it("says when GitHub activity was synced", () => {
    expect(auditSyncLine({ status: "ok", syncedAt: "2026-10-02T11:58:00Z" }, NOW)).toEqual({ tone: "ok", text: "GitHub activity synced 2m ago" });
    expect(auditSyncLine({ status: "ok", syncedAt: "2026-10-02T11:59:50Z" }, NOW)?.text).toBe("GitHub activity synced just now");
    expect(auditSyncLine({ status: "ok", syncedAt: null }, NOW)?.text).toBe("GitHub activity synced");
  });

  it("says GitHub could not be reached when the last read did not land", () => {
    expect(auditSyncLine({ status: "failed", syncedAt: null }, NOW)).toEqual({
      tone: "warning",
      text: "Couldn't reach GitHub just now — showing what was saved",
    });
    expect(auditSyncLine({ status: "stale", syncedAt: "2026-10-02T09:00:00Z" }, NOW)?.text).toBe(
      "Couldn't reach GitHub just now — showing what was saved (last synced 3h ago)",
    );
  });

  it("draws no line without a sync state", () => {
    expect(auditSyncLine(null, NOW)).toBeNull();
  });

  it("labels the sync button", () => {
    expect(auditSyncButtonLabel(false)).toBe("Sync now");
    expect(auditSyncButtonLabel(true)).toBe("Syncing...");
  });
});

describe("the source filter", () => {
  const rows = normalizeAuditPage({
    enabled: true,
    items: [
      wire({ id: "gh", eventCode: "github.push", scope: "github", metadata: { branch: "dev", size: 1 } }),
      wire({ id: "app" }),
      wire({ id: "proj", scope: "project", eventCode: "qa.requirement.created" }),
    ],
  }).items;

  it("keeps everything, only ALPHACI's own events, or only GitHub's", () => {
    expect(filterAuditRows(rows, "all").map((row) => row.id)).toEqual(["gh", "app", "proj"]);
    expect(filterAuditRows(rows, "alphaci").map((row) => row.id)).toEqual(["app", "proj"]);
    expect(filterAuditRows(rows, "github").map((row) => row.id)).toEqual(["gh"]);
  });

  it("is offered once the trail can hold GitHub activity", () => {
    expect(showAuditFilters(rows, null)).toBe(true);
    expect(showAuditFilters(rows.slice(1), null)).toBe(false);
    expect(showAuditFilters([], { status: "ok", syncedAt: null })).toBe(true);
  });

  it("words an empty filter and the push disclosure", () => {
    expect(auditFilterEmptyMessage("github")).toBe("No GitHub activity among the loaded events.");
    expect(auditFilterEmptyMessage("alphaci")).toBe("No ALPHACI events among the loaded events.");
    expect(auditFilterEmptyMessage("all")).toBe("No activity recorded yet.");
    expect(pushCommitsToggleLabel(3, false)).toBe("3 commits");
    expect(pushCommitsToggleLabel(1, false)).toBe("1 commit");
    expect(pushCommitsToggleLabel(3, true)).toBe("Hide commits");
  });
});
