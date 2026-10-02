import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import { useProjectAuditViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-audit-view-model";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { AuditTab } from "../../../../../../src/features/projects/detail/views/audit-tab";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { audit: jest.fn() },
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
