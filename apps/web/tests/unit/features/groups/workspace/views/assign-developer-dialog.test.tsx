import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { AssignDeveloperDialog } from "../../../../../../src/features/groups/workspace/views/assign-developer-dialog";
import {
  createRepositoryAssignment,
  getGroupMembers,
} from "../../../../../../src/features/groups/data/hierarchy-api";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/groups/data/hierarchy-api", () => ({
  ...jest.requireActual("../../../../../../src/features/groups/data/hierarchy-api"),
  createRepositoryAssignment: jest.fn(),
  getGroupMembers: jest.fn(),
}));

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

describe("AssignDeveloperDialog refusal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    (getGroupMembers as jest.Mock).mockResolvedValue([
      { userId: "u1", role: "member", memberStatus: "active", login: "dev", name: "Dev" },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the Developers-only sentence on ASSIGNMENT_ROLE_NOT_ALLOWED", async () => {
    (createRepositoryAssignment as jest.Mock).mockRejectedValue(
      new ApiError("Request failed with status 400", 400, {
        code: "ASSIGNMENT_ROLE_NOT_ALLOWED",
        message: "x",
      }),
    );
    act(() => {
      root.render(
        <AssignDeveloperDialog
          open
          groupId="g1"
          repositoryId="r1"
          onClose={jest.fn()}
          onAssigned={jest.fn()}
        />,
      );
    });
    await poll(() => document.querySelector("#assign-user option[value='u1']") !== null);
    const select = document.querySelector<HTMLSelectElement>("#assign-user")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      setter.call(select, "u1");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent === "Assign access")!
        .click();
    });
    await poll(
      () => document.body.textContent?.includes("Only Developers are assigned repositories") ?? false,
    );
  });
});
