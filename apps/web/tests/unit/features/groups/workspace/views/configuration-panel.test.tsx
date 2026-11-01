import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ConfigurationPanel } from "../../../../../../src/features/groups/workspace/views/configuration-panel";
import {
  deleteConfigurationEntry,
  getRepositoryConfiguration,
  putConfigurationVariable,
} from "../../../../../../src/features/groups/data/hierarchy-api";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/groups/data/hierarchy-api", () => ({
  ...jest.requireActual("../../../../../../src/features/groups/data/hierarchy-api"),
  getRepositoryConfiguration: jest.fn(),
  putConfigurationVariable: jest.fn(),
  putConfigurationSecret: jest.fn(),
  deleteConfigurationEntry: jest.fn(),
}));

const mockGet = getRepositoryConfiguration as jest.Mock;
const mockPut = putConfigurationVariable as jest.Mock;
const mockDelete = deleteConfigurationEntry as jest.Mock;

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

describe("ConfigurationPanel role gate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      variables: [
        { name: "FLAG", environmentScope: "non_production", updatedAt: "2026-09-01T00:00:00Z" },
      ],
      secrets: [
        { name: "TOKEN", environmentScope: "non_production", updatedAt: "2026-09-01T00:00:00Z" },
      ],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(canWrite: boolean) {
    act(() => {
      root.render(<ConfigurationPanel repositoryId="repo-1" canWrite={canWrite} />);
    });
    await poll(() => container.textContent?.includes("FLAG") ?? false);
  }

  function labels() {
    return Array.from(container.querySelectorAll("button")).map((b) => b.textContent ?? "");
  }

  it("hides add and delete controls but keeps the lists and a note when the viewer cannot write", async () => {
    await render(false);
    expect(labels().some((l) => l.startsWith("Add "))).toBe(false);
    expect(labels()).not.toContain("Delete");
    expect(container.textContent).toContain("FLAG");
    expect(container.textContent).toContain("TOKEN");
    expect(container.textContent).toContain("Developers and admins can add or delete");
  });

  it("shows add and delete controls when the viewer can write", async () => {
    await render(true);
    expect(labels()).toContain("Add variable");
    expect(labels()).toContain("Add secret");
    expect(labels().filter((l) => l === "Delete")).toHaveLength(2);
    expect(container.textContent).not.toContain("Developers and admins can add or delete");
  });

  it("shows the mapped sentence when a delete is refused", async () => {
    mockDelete.mockRejectedValue(
      new ApiError("Request failed with status 403", 403, { code: "ENV_VARS_LEAD_ONLY", message: "x" }),
    );
    await render(true);
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent === "Delete")!
        .click();
    });
    await poll(() => container.textContent?.includes("Developers and admins can change repository") ?? false);
  });

  it("does not call the write endpoints for a viewer who cannot write", async () => {
    await render(false);
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
