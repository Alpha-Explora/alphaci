import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import {
  useProjectAuditViewModel,
  type ProjectAuditViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-project-audit-view-model";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { audit: jest.fn(), syncAudit: jest.fn() },
}));

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;

function event(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    eventCode: "pull_request_merged",
    message: "Merged.",
    actorUserId: null,
    actorLogin: "ana",
    metadata: {},
    createdAt: "2026-10-02T10:00:00Z",
    scope: "repository",
    ...overrides,
  };
}

const PUSH = event("gh-1", {
  eventCode: "github.push",
  scope: "github",
  actorLogin: null,
  metadata: { branch: "dev", size: 2, githubLogin: "ana-gh", commits: [] },
});

let root: Root | null = null;
let latest: ProjectAuditViewModel | null = null;

function Harness({ onRender }: Readonly<{ onRender: (vm: ProjectAuditViewModel) => void }>) {
  onRender(useProjectAuditViewModel({ projectId: "p1", enabled: true }));
  return null;
}

function vm(): ProjectAuditViewModel {
  if (!latest) throw new Error("not rendered");
  return latest;
}

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness onRender={(value) => (latest = value)} />);
  });
}

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  latest = null;
  jest.clearAllMocks();
});

describe("useProjectAuditViewModel: GitHub activity", () => {
  it("exposes the sync state and offers the source filter", async () => {
    repo.audit.mockResolvedValue({
      enabled: true,
      items: [PUSH, event("a-1")],
      next: null,
      githubSync: { status: "ok", syncedAt: "2026-10-02T11:58:00Z" },
    } as never);
    await render();
    await poll(() => vm().status === "ready");

    expect(vm().githubSync).toEqual({ status: "ok", syncedAt: "2026-10-02T11:58:00Z" });
    expect(vm().showFilters).toBe(true);
    expect(vm().filter).toBe("all");
    expect(vm().filteredRows.map((row) => row.id)).toEqual(["gh-1", "a-1"]);
    expect(vm().rows[0]).toMatchObject({ label: "Pushed 2 commits to dev", actor: "ana-gh", scope: "github" });

    await act(async () => vm().setFilter("github"));
    expect(vm().filteredRows.map((row) => row.id)).toEqual(["gh-1"]);
    await act(async () => vm().setFilter("alphaci"));
    expect(vm().filteredRows.map((row) => row.id)).toEqual(["a-1"]);
    // The filter never asks the server.
    expect(repo.audit).toHaveBeenCalledTimes(1);
  });

  it("offers no filter or sync on an older backend", async () => {
    repo.audit.mockResolvedValue({ enabled: true, items: [event("a-1")], next: null } as never);
    await render();
    await poll(() => vm().status === "ready");
    expect(vm().githubSync).toBeNull();
    expect(vm().showFilters).toBe(false);
  });

  it("syncs, then replaces the shown pages with a fresh first page", async () => {
    repo.audit
      .mockResolvedValueOnce({
        enabled: true,
        items: [event("a-1")],
        next: "cursor",
        githubSync: { status: "failed", syncedAt: null },
      } as never)
      .mockResolvedValueOnce({
        enabled: true,
        items: [PUSH, event("a-1")],
        next: null,
        githubSync: { status: "ok", syncedAt: "2026-10-02T12:00:00Z" },
      } as never);
    repo.syncAudit.mockResolvedValue({ synced: 1 });
    await render();
    await poll(() => vm().status === "ready");
    expect(vm().githubSync?.status).toBe("failed");

    await act(async () => {
      await vm().syncNow();
    });
    expect(repo.syncAudit).toHaveBeenCalledWith("p1");
    expect(repo.audit).toHaveBeenLastCalledWith("p1", { limit: 50 });
    expect(vm().rows.map((row) => row.id)).toEqual(["gh-1", "a-1"]);
    expect(vm().githubSync?.status).toBe("ok");
    expect(vm().hasMore).toBe(false);
    expect(vm().syncing).toBe(false);
    expect(vm().syncError).toBeNull();
  });

  it("keeps the rows and says so when the sync fails, with a sign-in link for a stale session", async () => {
    repo.audit.mockResolvedValue({
      enabled: true,
      items: [event("a-1")],
      next: null,
      githubSync: { status: "ok", syncedAt: null },
    } as never);
    repo.syncAudit.mockRejectedValueOnce(new ApiError("x", 502)).mockRejectedValueOnce(new ApiError("x", 401));
    await render();
    await poll(() => vm().status === "ready");

    await act(async () => {
      await vm().syncNow();
    });
    expect(vm().syncError).toBe("Couldn't sync with GitHub. Try again in a moment.");
    expect(vm().syncSignInHref).toBeNull();
    expect(vm().rows).toHaveLength(1);

    await act(async () => {
      await vm().syncNow();
    });
    expect(vm().syncError).toBe("GitHub needs you to sign in again before ALPHACI can sync this repository's GitHub activity.");
    expect(vm().syncSignInHref).toBe("/login?next=/projects/p1");
    expect(repo.audit).toHaveBeenCalledTimes(1);
  });
});
