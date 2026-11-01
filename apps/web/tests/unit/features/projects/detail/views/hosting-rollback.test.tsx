import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { HostingDeploymentCard } from "../../../../../../src/features/projects/detail/views/hosting-deployment-card";
import type { RollbackControls } from "../../../../../../src/features/projects/detail/views/hosting-rollback";
import type { HostingEnvironment } from "../../../../../../src/features/projects/detail/model/hosting-environment-rules";
import type { DeploymentTarget, ProjectDeploymentHistoryItem } from "../../../../../../src/shared/api/contracts";

const TARGET = {
  id: "t-1",
  provider: "render",
  providerProjectName: "orders-api",
  branchName: "main",
  providerMetadata: {},
  publicUrl: "https://orders-api.onrender.com",
} as unknown as DeploymentTarget;

const ENV: HostingEnvironment = {
  kind: "production",
  label: "Production",
  lane: "production",
  branch: "main",
  tone: "ok",
  subLabel: "main · live",
  preview: null,
  previewBranches: [],
};

function deploy(id: string, status: ProjectDeploymentHistoryItem["status"]): ProjectDeploymentHistoryItem {
  return {
    id,
    targetId: "t-1",
    targetName: "orders-api",
    provider: "render",
    environment: null,
    branch: "main",
    commitSha: `${id}1234567`,
    commitMessage: `deploy ${id}`,
    status,
    createdAt: "2026-10-12T10:00:00Z",
    readyAt: null,
    deploymentUrl: null,
    pullRequestNumber: null,
    inspectorUrl: null,
    dashboardUrl: "",
    consoleUrl: "",
  };
}

const DEPLOYS = [deploy("d3", "ready"), deploy("d2", "superseded")];

let root: Root | null = null;
let container: HTMLElement;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function controls(overrides: Partial<RollbackControls> = {}): RollbackControls {
  return {
    offers: (item) => item.id === "d2",
    hold: null,
    canResume: false,
    busy: false,
    rollback: jest.fn().mockResolvedValue(null),
    resume: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

async function render(rollback: RollbackControls | null) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <HostingDeploymentCard
        target={TARGET}
        environment={ENV}
        previews={null}
        deploys={{ items: DEPLOYS, byBranch: true }}
        allDeploys={DEPLOYS}
        history={{ enabled: true, response: null }}
        onOpenPullRequest={undefined}
        domains={null}
        rollback={rollback}
      />,
    );
  });
}

const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("button")];
const buttonNamed = (name: string) => buttons().find((item) => item.textContent?.trim() === name);

function typeReason(value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Roll back on the Hosting deployment card", () => {
  it("offers Roll back only on the rows it is allowed for, and none without controls", async () => {
    await render(controls());
    const rows = [...container.querySelectorAll(".hosting-row")];
    expect(rows[0].querySelector(".hosting-row__rollback")).toBeNull();
    expect(rows[1].querySelector(".hosting-row__rollback")?.getAttribute("aria-label")).toBe("Roll back to d212345");

    act(() => root?.unmount());
    root = null;
    await render(null);
    expect(container.querySelector(".hosting-row__rollback")).toBeNull();
  });

  it("asks for a reason before rolling back, then sends the deploy and the reason", async () => {
    const rollback = jest.fn().mockResolvedValue(null);
    await render(controls({ rollback }));
    await act(async () => container.querySelector<HTMLButtonElement>(".hosting-row__rollback")!.click());

    expect(document.body.textContent).toContain("Roll back orders-api");
    expect(document.body.textContent).toContain("The next deploy from the pipeline puts the newest code back live");
    const submit = () => buttons().filter((item) => item.textContent?.trim() === "Roll back").at(-1)!;
    expect(submit().disabled).toBe(true);

    typeReason("checkout is broken");
    expect(submit().disabled).toBe(false);
    await act(async () => submit().click());
    expect(rollback).toHaveBeenCalledWith(DEPLOYS[1], "checkout is broken");
    expect(document.body.textContent).not.toContain("Roll back orders-api");
  });

  it("keeps the dialog open with the server's reason when the rollback is refused", async () => {
    await render(controls({ rollback: jest.fn().mockResolvedValue("That deploy is already live.") }));
    await act(async () => container.querySelector<HTMLButtonElement>(".hosting-row__rollback")!.click());
    typeReason("broken release");
    await act(async () => buttons().filter((item) => item.textContent?.trim() === "Roll back").at(-1)!.click());
    expect(document.body.textContent).toContain("That deploy is already live.");
    expect(document.body.textContent).toContain("Roll back orders-api");
  });

  it("explains a held rollback to everyone, and lets those who may resume deploys", async () => {
    const hold = {
      deployId: "d2",
      commitSha: "d2abcdef",
      commitMessage: "good",
      reason: "checkout broke",
      rolledBackBy: "u",
      rolledBackAt: "2026-10-12T10:00:00Z",
      holdsNewDeploys: true,
    };
    await render(controls({ hold, canResume: false }));
    const banner = container.querySelector(".hosting-hold")!;
    expect(banner.textContent).toContain("Rolled back");
    expect(banner.textContent).toContain("d2abcde");
    expect(banner.textContent).toContain("checkout broke");
    expect(buttonNamed("Resume deploys")).toBeUndefined();

    act(() => root?.unmount());
    root = null;
    const resume = jest.fn().mockResolvedValue(null);
    await render(controls({ hold, canResume: true, resume }));
    await act(async () => buttonNamed("Resume deploys")!.click());
    expect(document.body.textContent).toContain("The newest production deploy goes live again");
    await act(async () => buttons().filter((item) => item.textContent?.trim() === "Resume deploys").at(-1)!.click());
    expect(resume).toHaveBeenCalled();
  });
});
