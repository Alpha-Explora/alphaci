import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import {
  useProjectFolderViewModel,
  type ProjectFolderViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-project-folder-view-model";
import type { ProjectFolderSummary } from "../../../../../../src/features/projects/detail/model/project-folder-types";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { folder: jest.fn() },
}));

const folderMock = projectsRepository.folder as jest.MockedFunction<typeof projectsRepository.folder>;

function shop(overrides: Partial<ProjectFolderSummary> = {}): ProjectFolderSummary {
  return {
    deliveryProjectId: "dp-1",
    groupId: "ws-1",
    name: "shop",
    repositories: [
      { projectId: "proj-fe", name: "shop-fe", repoFullName: "Org/shop-fe", role: "frontend", status: "provisioned" },
      { projectId: "proj-be", name: "shop-be", repoFullName: "Org/shop-be", role: "backend", status: "provisioned" },
    ],
    ...overrides,
  };
}

let root: Root | null = null;
let latest: ProjectFolderViewModel | null = null;

function Harness({
  projectId,
  enabled,
  onRender,
}: Readonly<{ projectId: string; enabled: boolean; onRender: (vm: ProjectFolderViewModel) => void }>) {
  onRender(useProjectFolderViewModel({ projectId, enabled }));
  return null;
}

function vm(): ProjectFolderViewModel {
  if (!latest) throw new Error("not rendered");
  return latest;
}

async function render(projectId: string, enabled = true) {
  if (!root) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root!.render(
      <Harness
        projectId={projectId}
        enabled={enabled}
        onRender={(value) => {
          latest = value;
        }}
      />,
    );
  });
}

/** Polls until `check` stops throwing. */
async function waitFor(check: () => void, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  latest = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

describe("useProjectFolderViewModel", () => {
  it("stays idle, and reads nothing, until enabled", async () => {
    await render("proj-fe", false);
    expect(vm().status).toBe("idle");
    expect(vm().projectName).toBeNull();
    expect(folderMock).not.toHaveBeenCalled();
  });

  it("titles a multi-repository Project and builds the switch", async () => {
    folderMock.mockResolvedValue(shop());
    await render("proj-be");
    await waitFor(() => expect(vm().status).toBe("ready"));
    expect(folderMock).toHaveBeenCalledWith("proj-be");
    expect(vm().projectName).toBe("shop");
    expect(vm().options.map((option) => [option.roleLabel, option.label, option.current])).toEqual([
      ["FRONTEND", "shop-fe", false],
      ["BACKEND", "shop-be", true],
    ]);
  });

  it("names the Project for QA whatever its size, and nothing without a folder", async () => {
    folderMock.mockResolvedValue(shop({ repositories: shop().repositories.slice(0, 1) }));
    await render("proj-fe");
    await waitFor(() => expect(vm().status).toBe("ready"));
    expect(vm().projectName).toBeNull();
    expect(vm().project).toEqual({
      deliveryProjectId: "dp-1",
      name: "shop",
      href: "/workflows?group=ws-1&project=dp-1",
      repositories: [{ projectId: "proj-fe", role: "frontend" }],
    });

    await render("proj-none", false);
    expect(vm().project).toEqual({ deliveryProjectId: null, name: null, href: null, repositories: [] });
  });

  it("hands QA each repository's role, so QA Studio can leave the backend's API tests out", async () => {
    folderMock.mockResolvedValue(shop());
    await render("proj-fe");
    await waitFor(() => expect(vm().status).toBe("ready"));
    expect(vm().project.repositories).toEqual([
      { projectId: "proj-fe", role: "frontend" },
      { projectId: "proj-be", role: "backend" },
    ]);
  });

  it("keeps the single-repository page for a Project of one", async () => {
    folderMock.mockResolvedValue(shop({ repositories: shop().repositories.slice(0, 1) }));
    await render("proj-fe");
    await waitFor(() => expect(vm().status).toBe("ready"));
    expect(vm().projectName).toBeNull();
    expect(vm().options).toEqual([]);
  });

  it("reads a 404 (an older backend) as unavailable and changes nothing", async () => {
    folderMock.mockRejectedValue(new ApiError("Not Found", 404));
    await render("proj-fe");
    await waitFor(() => expect(vm().status).toBe("unavailable"));
    expect(vm().projectName).toBeNull();
    expect(vm().options).toEqual([]);
  });

  it("reads a malformed body as unavailable", async () => {
    folderMock.mockResolvedValue(null);
    await render("proj-fe");
    await waitFor(() => expect(vm().status).toBe("unavailable"));
    expect(vm().projectName).toBeNull();
  });

  it("never shows the previous project's folder, and a slow first read cannot win", async () => {
    const slow = deferred<ProjectFolderSummary | null>();
    folderMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(shop({ name: "second" }));
    await render("proj-fe");
    await render("proj-be");
    await waitFor(() => expect(vm().projectName).toBe("second"));
    await act(async () => {
      slow.resolve(shop({ name: "first" }));
      await slow.promise;
    });
    expect(vm().projectName).toBe("second");
    expect(vm().options.find((option) => option.current)?.projectId).toBe("proj-be");
  });

  it("is loading again, not showing stale data, right after the project changes", async () => {
    folderMock.mockResolvedValueOnce(shop()).mockReturnValueOnce(new Promise(() => undefined));
    await render("proj-fe");
    await waitFor(() => expect(vm().status).toBe("ready"));
    await render("proj-be");
    expect(vm().status).toBe("loading");
    expect(vm().projectName).toBeNull();
  });
});
