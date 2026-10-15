import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import { DRIFT_REPAIR_LEAD_ONLY_MESSAGE } from "../../../../../../src/features/projects/detail/model/drift-finding-rules";
import { ProjectDriftPanel } from "../../../../../../src/features/projects/detail/views/project-drift-panel";
import type {
  AppRole,
  ProjectDriftFinding,
  ProjectDriftResponse,
} from "../../../../../../src/shared/api/contracts";

jest.mock(
  "../../../../../../src/features/projects/data/projects-repository",
  () => ({
    projectsRepository: {
      drift: jest.fn(),
      runDrift: jest.fn(),
      repairDrift: jest.fn(),
    },
  }),
);

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;

const PR_URL = "https://github.com/tone/orders-api/pull/42";

const CI_FINDING: ProjectDriftFinding = {
  id: "f-ci",
  projectId: "p1",
  targetId: null,
  source: "github_live",
  severity: "error",
  code: "ci_api_url_stale",
  message:
    "CI workflows still point at http://localhost:4000 instead of https://api.alphaci.test.",
  details: { files: [{ branch: "dev", path: ".github/workflows/ci.yml" }] },
  status: "active",
  detectedAt: "2026-10-16T00:00:00.000Z",
  resolvedAt: null,
};

function found(findings: ProjectDriftFinding[]): ProjectDriftResponse {
  return { enabled: true, mode: "local_snapshot", findings };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function render(appRole: AppRole | null) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<ProjectDriftPanel projectId="p1" appRole={appRole} />);
  });
  await flush();
}

function text(): string {
  return container?.textContent ?? "";
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container?.querySelectorAll("button") ?? []).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
}

function links(): string[] {
  return Array.from(container?.querySelectorAll("a") ?? []).map(
    (anchor) => anchor.getAttribute("href") ?? "",
  );
}

async function click(target: HTMLButtonElement) {
  await act(async () => {
    target.click();
  });
  await flush();
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  jest.clearAllMocks();
});

describe("ProjectDriftPanel", () => {
  it("shows a stale CI address in plain language, with the workflow files it names", async () => {
    repo.drift.mockResolvedValue(found([CI_FINDING]));

    await render("member");

    expect(text()).toContain("CI points at an old AlphaCI address");
    expect(text()).toContain("dev: .github/workflows/ci.yml");
    expect(text()).toContain(CI_FINDING.message);
  });

  it("asks once before it acts, then reports the pull request the repair opened and checks again", async () => {
    repo.drift.mockResolvedValue(found([CI_FINDING]));
    repo.repairDrift.mockResolvedValue({
      enabled: true,
      mode: "local_safe",
      findingId: "f-ci",
      action: "repair_ci_api_url",
      status: "completed",
      message: `Opened a pull request into dev: ${PR_URL}`,
      result: { pullRequestUrl: PR_URL, pullRequestNumber: 42 },
    });
    repo.runDrift.mockResolvedValue(found([]));

    await render("lead");
    const repair = button("Repair");
    expect(repair).toBeDefined();

    await click(repair as HTMLButtonElement);
    expect(repo.repairDrift).not.toHaveBeenCalled();
    expect(text()).toContain("open a pull request into dev");

    await click(button("Confirm repair") as HTMLButtonElement);

    expect(repo.repairDrift).toHaveBeenCalledWith(
      "p1",
      "f-ci",
      "repair_ci_api_url",
    );
    expect(repo.runDrift).toHaveBeenCalledWith("p1");
    expect(text()).toContain(`Opened a pull request into dev: ${PR_URL}`);
    expect(links()).toContain(PR_URL);
    expect(text()).toContain("No active findings.");
  });

  it("shows no pull request link when the repair found nothing to change", async () => {
    repo.drift.mockResolvedValue(found([CI_FINDING]));
    repo.repairDrift.mockResolvedValue({
      enabled: true,
      mode: "local_safe",
      findingId: "f-ci",
      action: "repair_ci_api_url",
      status: "completed",
      message:
        "CI points at https://api.alphaci.test; dev already names it, so no workflow change was needed.",
      result: {},
    });
    repo.runDrift.mockResolvedValue(found([CI_FINDING]));

    await render("lead");
    await click(button("Repair") as HTMLButtonElement);
    await click(button("Confirm repair") as HTMLButtonElement);

    expect(text()).toContain("no workflow change was needed");
    expect(links()).toEqual([]);
  });

  it("shows the repair to a member only as a note, because the backend refuses them", async () => {
    repo.drift.mockResolvedValue(found([CI_FINDING]));

    await render("member");

    expect(button("Repair")).toBeUndefined();
    expect(text()).toContain(DRIFT_REPAIR_LEAD_ONLY_MESSAGE);
  });

  it("says plainly when health checks are off for this deployment", async () => {
    repo.drift.mockResolvedValue({
      enabled: false,
      mode: "local_snapshot",
      findings: [],
    });

    await render("admin");

    expect(text()).toContain(
      "Health checks are not enabled on this deployment.",
    );
  });

  it("reports a failed check instead of leaving the list looking clean", async () => {
    repo.drift.mockResolvedValue(found([]));
    repo.runDrift.mockRejectedValue(new Error("network down"));

    await render("lead");
    await click(button("Run check") as HTMLButtonElement);

    expect(text()).toContain("Unable to run the health checks.");
  });
});
