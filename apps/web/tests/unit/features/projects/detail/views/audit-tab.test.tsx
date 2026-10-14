import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import { useProjectAuditViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-audit-view-model";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { AuditTab } from "../../../../../../src/features/projects/detail/views/audit-tab";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { audit: jest.fn(), syncAudit: jest.fn() },
}));

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;
const PROJECT = { id: "p1" } as ProvisionedProject;
const CURSOR = "2026-10-01T09:00:00.654321+00:00";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    eventCode: "pull_request_merged",
    message: "Merged pull request #12 into dev.",
    actorUserId: "u-1",
    actorLogin: "ana",
    metadata: {},
    createdAt: "2026-10-01T10:00:00.000000+00:00",
    scope: "repository",
    ...overrides,
  };
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

function Harness() {
  const audit = useProjectAuditViewModel({ projectId: "p1", enabled: true });
  return <AuditTab project={PROJECT} vm={{ audit } as unknown as ProjectDetailTabsViewModel} />;
}

async function render(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness />);
  });
  return container;
}

function button(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) => b.textContent === label);
}

describe("Audit tab", () => {
  it("shows each event in words, its actor (or System), a relative time with the exact one on hover, and a Project tag", async () => {
    repo.audit.mockResolvedValue({
      enabled: true,
      items: [
        event(),
        event({
          id: "ev-2",
          eventCode: "qa.requirement.created",
          message: "Added Feature Checkout.",
          actorLogin: null,
          scope: "project",
        }),
      ],
      next: null,
    } as never);
    const container = await render();
    await poll(() => container.querySelectorAll("li.audit-trail__row:not(.audit-trail__row--skeleton)").length === 2);

    expect(repo.audit).toHaveBeenCalledWith("p1", { limit: 50 });
    const rows = [...container.querySelectorAll("li.audit-trail__row")];
    expect(rows[0].textContent).toContain("Pull request merged");
    expect(rows[0].textContent).toContain("Merged pull request #12 into dev.");
    expect(rows[0].textContent).toContain("ana");
    expect(rows[0].querySelector(".audit-trail__tag")).toBeNull();
    const time = rows[0].querySelector("time")!;
    expect(time.getAttribute("dateTime")).toBe("2026-10-01T10:00:00.000000+00:00");
    expect(time.getAttribute("title")).toBeTruthy();
    expect(time.textContent).toMatch(/ago|just now/);

    expect(rows[1].textContent).toContain("Requirement added");
    expect(rows[1].textContent).toContain("System");
    expect(rows[1].querySelector(".audit-trail__tag")?.textContent).toBe("Project");
    // The last page: no Load more.
    expect(button(container, "Load more")).toBeUndefined();
  });

  it("loads older events with the cursor passed back unchanged, appending them", async () => {
    repo.audit
      .mockResolvedValueOnce({ enabled: true, items: [event()], next: CURSOR } as never)
      .mockResolvedValueOnce({
        enabled: true,
        items: [event({ id: "ev-0", eventCode: "project_created", message: "Repository created" })],
        next: null,
      } as never);
    const container = await render();
    await poll(() => button(container, "Load more") !== undefined);

    await act(async () => {
      button(container, "Load more")!.click();
    });
    await poll(() => container.textContent?.includes("Repository created") ?? false);

    expect(repo.audit).toHaveBeenLastCalledWith("p1", { limit: 50, before: CURSOR });
    expect(container.querySelectorAll("li.audit-trail__row")).toHaveLength(2);
    expect(button(container, "Load more")).toBeUndefined();
  });

  it("keeps the shown rows and says so when an older page fails", async () => {
    repo.audit
      .mockResolvedValueOnce({ enabled: true, items: [event()], next: CURSOR } as never)
      .mockRejectedValueOnce(new Error("boom"));
    const container = await render();
    await poll(() => button(container, "Load more") !== undefined);
    await act(async () => {
      button(container, "Load more")!.click();
    });
    await poll(() => container.textContent?.includes("Unable to load older audit events") ?? false);
    expect(container.textContent).toContain("Pull request merged");
    expect(button(container, "Load more")).toBeDefined();
  });

  it("says recording is off when the deployment does not record audit events", async () => {
    repo.audit.mockResolvedValue({ enabled: false, items: [] } as never);
    const container = await render();
    await poll(() => container.textContent?.includes("Audit recording is turned off for this deployment.") ?? false);
  });

  it("says nothing was recorded yet when recording is on", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [], next: null } as never);
    const container = await render();
    await poll(() => container.textContent?.includes("No activity recorded yet.") ?? false);
  });

  it("shows a load error", async () => {
    repo.audit.mockRejectedValue(new Error("boom"));
    const container = await render();
    await poll(() => container.textContent?.includes("Unable to load audit events.") ?? false);
  });
});

describe("Audit tab: GitHub activity", () => {
  const push = event({
    id: "gh-push",
    eventCode: "github.push",
    message: "ana-gh pushed to dev",
    actorLogin: null,
    scope: "github",
    metadata: {
      branch: "dev",
      size: 3,
      forced: false,
      githubLogin: "ana-gh",
      commits: [
        { sha: "a".repeat(40), message: "Add checkout\n\nbody", authorName: "Ana" },
        { sha: "b".repeat(40), message: "Fix total", authorName: "Ana" },
      ],
    },
  });
  const merged = event({
    id: "gh-pr",
    eventCode: "github.pull_request.merged",
    actorLogin: "bo",
    scope: "github",
    metadata: { number: 12, title: "Checkout", base: "uat", head: "dev", state: "merged" },
  });

  function rowEls(container: HTMLElement) {
    return [...container.querySelectorAll<HTMLLIElement>("li.audit-trail__row:not(.audit-trail__row--skeleton)")];
  }

  it("words GitHub events, tags them GitHub and names the GitHub login", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [push, merged, event()], next: null } as never);
    const container = await render();
    await poll(() => rowEls(container).length === 3);

    const [pushRow, prRow, appRow] = rowEls(container);
    expect(pushRow.querySelector(".audit-trail__label")?.textContent).toContain("Pushed 3 commits to dev");
    expect(pushRow.querySelector(".audit-trail__tag--github")?.textContent).toBe("GitHub");
    expect(pushRow.querySelector(".audit-trail__actor")?.textContent).toBe("ana-gh");
    // The server's sentence only repeats GitHub's, so it is not shown.
    expect(pushRow.querySelector(".audit-trail__detail")).toBeNull();
    expect(prRow.textContent).toContain("Merged pull request #12 into uat");
    expect(prRow.querySelector(".audit-trail__actor")?.textContent).toBe("bo");
    expect(appRow.querySelector(".audit-trail__tag--github")).toBeNull();
  });

  it("expands a push to its commits, with the unlisted ones counted", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [push], next: null } as never);
    const container = await render();
    await poll(() => rowEls(container).length === 1);

    const toggle = container.querySelector<HTMLButtonElement>(".audit-trail__push-toggle")!;
    expect(toggle.textContent).toBe("3 commits");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".audit-trail__commits")).toBeNull();

    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const commits = [...container.querySelectorAll(".audit-trail__commit")].map((li) => li.textContent);
    expect(commits).toEqual(["aaaaaaaAdd checkout", "bbbbbbbFix total", "and 1 more not listed"]);
    expect(container.querySelector(".audit-trail__commits")?.id).toBe(toggle.getAttribute("aria-controls"));

    await act(async () => toggle.click());
    expect(container.querySelector(".audit-trail__commits")).toBeNull();
  });

  it("filters the loaded rows by source", async () => {
    repo.audit.mockResolvedValue({
      enabled: true,
      items: [push, event()],
      next: null,
      githubSync: { status: "ok", syncedAt: null },
    } as never);
    const container = await render();
    await poll(() => rowEls(container).length === 2);

    const chips = [...container.querySelectorAll<HTMLButtonElement>(".audit-trail__filter")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["All", "ALPHACI", "GitHub"]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");

    await act(async () => chips[2].click());
    expect(rowEls(container).map((row) => row.dataset.scope)).toEqual(["github"]);
    await act(async () => chips[1].click());
    expect(rowEls(container).map((row) => row.dataset.scope)).toEqual(["repository"]);
    expect(chips[1].getAttribute("aria-pressed")).toBe("true");
    expect(repo.audit).toHaveBeenCalledTimes(1);
  });

  it("says when a filter has nothing loaded", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [event()], next: null, githubSync: { status: "ok", syncedAt: null } } as never);
    const container = await render();
    await poll(() => button(container, "GitHub") !== undefined);
    await act(async () => button(container, "GitHub")!.click());
    expect(container.textContent).toContain("No GitHub activity among the loaded events.");
  });

  it("has no chips or sync line on an older backend", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [event()], next: null } as never);
    const container = await render();
    await poll(() => rowEls(container).length === 1);
    expect(container.querySelector(".audit-trail__filters")).toBeNull();
    expect(container.querySelector(".audit-trail__sync")).toBeNull();
  });

  it("shows the sync line and syncs now, then re-reads the first page", async () => {
    repo.audit
      .mockResolvedValueOnce({
        enabled: true,
        items: [event()],
        next: null,
        githubSync: { status: "failed", syncedAt: null },
      } as never)
      .mockResolvedValueOnce({
        enabled: true,
        items: [push, event()],
        next: null,
        githubSync: { status: "ok", syncedAt: new Date().toISOString() },
      } as never);
    repo.syncAudit.mockResolvedValue({});
    const container = await render();
    await poll(() => container.querySelector(".audit-trail__sync") !== null);

    const line = container.querySelector(".audit-trail__sync")!;
    expect(line.getAttribute("data-tone")).toBe("warning");
    expect(line.textContent).toContain("Couldn't reach GitHub just now — showing what was saved");

    await act(async () => button(container, "Sync now")!.click());
    await poll(() => rowEls(container).length === 2);
    expect(repo.syncAudit).toHaveBeenCalledWith("p1");
    expect(repo.audit).toHaveBeenLastCalledWith("p1", { limit: 50 });
    const fresh = container.querySelector(".audit-trail__sync")!;
    expect(fresh.getAttribute("data-tone")).toBe("ok");
    expect(fresh.textContent).toContain("GitHub activity synced just now");
  });

  it("says the first import is still running, not that GitHub failed", async () => {
    repo.audit.mockResolvedValue({
      enabled: true,
      items: [event()],
      next: null,
      githubSync: { status: "stale", syncedAt: null },
    } as never);
    const container = await render();
    await poll(() => container.querySelector(".audit-trail__sync") !== null);
    const line = container.querySelector(".audit-trail__sync")!;
    expect(line.getAttribute("data-tone")).toBe("pending");
    expect(line.textContent).toContain("Reading GitHub activity… showing what was saved for now");
    expect(line.textContent).not.toContain("Couldn't reach GitHub");
  });

  it("says a failed sync, and keeps the rows", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [event()], next: null, githubSync: { status: "ok", syncedAt: null } } as never);
    repo.syncAudit.mockRejectedValue(new Error("boom"));
    const container = await render();
    await poll(() => button(container, "Sync now") !== undefined);
    await act(async () => button(container, "Sync now")!.click());
    await poll(() => container.textContent?.includes("Couldn't sync with GitHub. Try again in a moment.") ?? false);
    expect(rowEls(container)).toHaveLength(1);
  });
});
