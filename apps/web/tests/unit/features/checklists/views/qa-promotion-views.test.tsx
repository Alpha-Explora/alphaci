import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole, ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { checklist } from "../checklist-fixtures";
import { apiErrorWith, promotionWire, readyWire } from "../qa-promotion-fixtures";
import { runAs, runItem } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/checklists-repository", () => ({
  checklistsRepository: { listForProject: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: {
    current: jest.fn(),
    create: jest.fn(),
    updateItem: jest.fn(),
    requestRetest: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    promotion: jest.fn(),
    mergePromotion: jest.fn(),
  },
}));
jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const checklists = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;

const PREVIEW: ProjectBranchPreview = {
  branch: "uat",
  isProduction: false,
  deploymentId: "d1",
  targetId: "web",
  targetName: "storefront-web",
  provider: "vercel",
  status: "ready",
  commitSha: "9f8e7d6",
  commitMessage: null,
  pullRequestNumber: null,
  previewUrl: "https://shop.example.com",
  inspectorUrl: null,
  createdAt: null,
  readyAt: null,
  embeddable: true,
  embedBlockedReason: null,
  surface: "page",
};

function setup(promotion: unknown, run: QaRun | null = null) {
  projects.previews.mockResolvedValue({ enabled: true, liveProvidersEnabled: true, providerError: null, branches: [PREVIEW] });
  checklists.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
  runs.current.mockResolvedValue({ commitSha: "9f8e7d6c5b4a", commitSource: "deployment", run });
  runs.promotion.mockResolvedValue(promotion as never);
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
  jest.clearAllMocks();
});

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function studio(role: AppRole): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<QaStudioPanel projectId="project-1" appRole={role} projectName="tone/storefront-web" />);
  });
  await settle();
  return container;
}

function card(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('section[aria-label="Production readiness"]');
  if (!found) throw new Error("no promotion card");
  return found;
}

function mergeButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>("button.qa-promo__merge");
}

async function click(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function dialogButton(name: string): HTMLButtonElement | undefined {
  return [...(dialog()?.querySelectorAll("button") ?? [])].find((button) => button.textContent === name);
}

describe("QA Studio — Ready for production card", () => {
  it("lead, not ready: every checklist row, the reasons, the PR link, and a disabled Merge to main that says why", async () => {
    setup(promotionWire());
    const container = await studio("lead");
    const section = card(container);
    expect(section.textContent).toContain("Not ready for production");
    expect(section.textContent).toContain("uat @ 9f8e7d6 → main");
    expect(section.textContent).toContain("1 of 2 checklists approved");
    const rows = [...section.querySelectorAll("li.qa-promo__row")].map((row) => row.textContent);
    expect(rows[0]).toContain("Release smoke test");
    expect(rows[0]).toContain("Approved for this commit");
    expect(rows[0]).toContain("Approved");
    expect(rows[1]).toContain("Accessibility pass");
    expect(rows[1]).toContain("Not verified on this commit yet");
    expect(section.textContent).toContain("Accessibility pass has no QA run on uat @ 9f8e7d6.");
    // The promotion PR is named, never linked: ALPHACI is the only UI.
    expect(section.querySelector("a.qa-promo__pr")).toBeNull();
    expect(section.querySelector(".qa-promo__pr")?.textContent).toBe("Promotion PR #42");
    expect(section.querySelector('a[href*="github.com"]')).toBeNull();
    const button = mergeButton(container)!;
    expect(button.disabled).toBe(true);
    const why = document.getElementById(button.getAttribute("aria-describedby")!);
    expect(why?.textContent).toBe("Merging opens once every shared checklist is signed off Approved on uat @ 9f8e7d6.");
  });

  it("QA Team sees the same status read-only: no Merge button, who merges instead", async () => {
    setup(readyWire());
    const container = await studio("qa");
    const section = card(container);
    expect(section.textContent).toContain("Ready for production");
    expect(mergeButton(container)).toBeNull();
    expect(section.textContent).toContain("Team leads merge uat into main once every checklist is approved.");
  });

  it("no button when the server withholds canMerge, even for a lead", async () => {
    setup(readyWire({ canMerge: false }));
    const container = await studio("lead");
    expect(mergeButton(container)).toBeNull();
  });

  it("renders nothing for a backend without the promotion route, and the run column still renders", async () => {
    setup(undefined);
    runs.promotion.mockRejectedValue(apiErrorWith(404));
    const container = await studio("lead");
    expect(container.querySelector(".qa-promo")).toBeNull();
    expect(container.querySelector(".qa-run-card")).not.toBeNull();
  });

  it("confirms before merging, naming the project, the commit and the PR; merged shows the merge commit", async () => {
    setup(readyWire());
    runs.mergePromotion.mockResolvedValue({
      merged: true,
      sha: "5555555abcdef",
      message: "Pull Request successfully merged",
      pullRequest: { number: 42, url: "https://github.com/tone/storefront-web/pull/42" },
    });
    const container = await studio("lead");
    const button = mergeButton(container)!;
    expect(button.disabled).toBe(false);
    await click(button);
    expect(dialog()?.textContent).toContain("Merge uat into main?");
    expect(dialog()?.textContent).toContain(
      "Merge tone/storefront-web uat @ 9f8e7d6 into main through pull request #42, with your GitHub account.",
    );
    expect(dialog()?.textContent).toContain("tone/storefront-web");
    expect(dialog()?.textContent).toContain("#42");
    expect(runs.mergePromotion).not.toHaveBeenCalled();
    await click(dialogButton("Merge to main"));
    expect(runs.mergePromotion).toHaveBeenCalledWith("project-1");
    // The dialog is closing (its exit animation may still be on screen in jsdom).
    expect(dialogButton("Merge to main")).toBeUndefined();
    const outcome = container.querySelector(".qa-promo-outcome")!;
    expect(outcome.getAttribute("data-tone")).toBe("success");
    expect(outcome.textContent).toContain("Merged into main");
    expect(outcome.textContent).toContain("main updated · merge commit 5555555");
    expect(runs.promotion).toHaveBeenCalledTimes(2);
    expect(mergeButton(container)!.disabled).toBe(true);
  });

  it("shows GitHub's refusal verbatim, with the hint", async () => {
    setup(readyWire());
    const refusal = "At least 1 approving review is required by reviewers with write access.";
    runs.mergePromotion.mockResolvedValue({ merged: false, sha: null, message: refusal, pullRequest: { number: 42, url: "https://github.com/tone/storefront-web/pull/42" } });
    const container = await studio("lead");
    await click(mergeButton(container));
    await click(dialogButton("Merge to main"));
    const outcome = container.querySelector(".qa-promo-outcome")!;
    expect(outcome.textContent).toContain("GitHub refused the merge");
    expect(outcome.querySelector("blockquote")?.textContent).toBe(refusal);
    expect(outcome.textContent).toContain("A reviewer must approve the pull request");
    expect(outcome.querySelector("a")).toBeNull();
    expect(outcome.querySelector(".qa-promo__pr")?.textContent).toBe("Pull request #42");
  });

  it("GITHUB_REAUTH offers a sign-in link back to this project", async () => {
    setup(readyWire());
    runs.mergePromotion.mockRejectedValue(apiErrorWith(409, { code: "GITHUB_REAUTH" }));
    const container = await studio("lead");
    await click(mergeButton(container));
    await click(dialogButton("Merge to main"));
    const link = container.querySelector<HTMLAnchorElement>("a.qa-promo-outcome__signin");
    expect(link?.getAttribute("href")).toBe("/login?next=/projects/project-1");
    expect(container.querySelector(".qa-promo-outcome")?.textContent).toContain("Sign in again to merge");
  });

  it("QA_PROMOTION_BLOCKED lists the server's reasons and re-reads the status", async () => {
    setup(readyWire());
    runs.mergePromotion.mockRejectedValue(
      apiErrorWith(409, { code: "QA_PROMOTION_BLOCKED", message: "QA approval is incomplete.", reasons: ["Release smoke test was reopened."] }),
    );
    const container = await studio("lead");
    await click(mergeButton(container));
    await click(dialogButton("Merge to main"));
    const outcome = container.querySelector(".qa-promo-outcome")!;
    expect(outcome.textContent).toContain("Not merged — QA approval is incomplete");
    expect(outcome.textContent).toContain("Release smoke test was reopened.");
    expect(runs.promotion).toHaveBeenCalledTimes(2);
  });

  it("starts folded to its head (Merge still reachable), unfolds on demand, and remembers it per viewer", async () => {
    setup(readyWire());
    const container = await studio("lead");
    const toggle = card(container).querySelector<HTMLButtonElement>("button.qa-promo__toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(card(container).querySelector<HTMLElement>(".qa-promo__body")?.hidden).toBe(true);
    expect(mergeButton(container)?.disabled).toBe(false);
    await click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(card(container).querySelector<HTMLElement>(".qa-promo__body")?.hidden).toBe(false);
    expect(window.localStorage.getItem("alphaci.qa-studio.promotion-card.collapsed")).toBe("0");
  });

  it("is mounted once and moves with the run column into the full-screen drawer", async () => {
    setup(readyWire(), runAs("lead", { branch: "uat", items: [runItem(0)] }));
    const container = await studio("lead");
    const before = card(container);
    const runCard = container.querySelector(".qa-run-card");
    await click(container.querySelector('button[aria-label="Full screen"]'));
    await click(container.querySelector("button.qa-launcher"));
    const drawer = container.querySelector('[role="region"]')!;
    expect(drawer.contains(before)).toBe(true);
    expect(container.querySelectorAll(".qa-promo")).toHaveLength(1);
    expect(card(container)).toBe(before);
    expect(container.querySelector(".qa-run-card")).toBe(runCard);
  });

  it("re-reads readiness after the run is signed off", async () => {
    const open = runAs("lead", { branch: "uat", items: [runItem(0, { status: "passed" })] });
    setup(promotionWire(), open);
    const signed = { ...open, status: "signed_off" as const, signoff: { id: "so-1", verdict: "APPROVED" as const, summary: null, conditions: null, signedBy: { id: "u", login: "tone" }, signedAt: "2026-09-26T00:00:00.000Z" } };
    runs.signoff.mockResolvedValue(signed);
    const container = await studio("lead");
    expect(runs.promotion).toHaveBeenCalledTimes(1);
    runs.promotion.mockResolvedValue(readyWire());
    await click([...container.querySelectorAll("button")].find((b) => b.textContent === "Sign off"));
    await click(dialogButton("Sign off"));
    expect(runs.signoff).toHaveBeenCalled();
    expect(runs.promotion).toHaveBeenCalledTimes(2);
    expect(card(container).textContent).toContain("Ready for production");
  });
});
