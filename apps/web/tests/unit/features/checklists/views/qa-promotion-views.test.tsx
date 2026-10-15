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

function chip(container: HTMLElement): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>("button.qa-promo-chip");
  if (!found) throw new Error("no readiness chip");
  return found;
}

function popover(container: HTMLElement): HTMLElement {
  const id = chip(container).getAttribute("aria-controls")!;
  const found = document.getElementById(id);
  if (!found) throw new Error("no popover");
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

async function key(element: Element, name: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
  });
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function dialogButton(name: string): HTMLButtonElement | undefined {
  return [...(dialog()?.querySelectorAll("button") ?? [])].find((button) => button.textContent === name);
}

describe("QA Studio — the readiness chip in the tab bar", () => {
  it("draws no promotion strip above the tabs: the chip sits in the tab bar, beside the tablist", async () => {
    setup(promotionWire());
    const container = await studio("admin");
    expect(container.querySelector(".qa-promo")).toBeNull();
    expect(container.querySelector('section[aria-label="Production readiness"]')).toBeNull();
    const bar = container.querySelector(".qa-coltabs-bar")!;
    expect(bar.contains(chip(container))).toBe(true);
    // The tablist holds only the tabs; the chip and the button sit beside it.
    const tablist = bar.querySelector('[role="tablist"]')!;
    expect(tablist.contains(chip(container))).toBe(false);
    expect([...tablist.children].every((child) => child.getAttribute("role") === "tab")).toBe(true);
  });

  it("keeps the chip and Merge to main in a Team lead's bar, which has no tablist", async () => {
    setup(promotionWire());
    const container = await studio("lead");
    const bar = container.querySelector(".qa-coltabs-bar")!;
    expect(bar.querySelector('[role="tablist"]')).toBeNull();
    expect(bar.contains(chip(container))).toBe(true);
    expect(bar.contains(mergeButton(container))).toBe(true);
  });

  it.each<[string, unknown, string, string, string]>([
    ["ready", readyWire(), "ready", "Ready for production", "Ready"],
    ["not ready", promotionWire(), "blocked", "Not ready for production", "Not ready"],
  ])("%s: tone, full name and the short label narrow columns show", async (_name, wire, tone, label, short) => {
    setup(wire);
    const container = await studio("qa");
    const button = chip(container);
    expect(button.getAttribute("data-tone")).toBe(tone);
    expect(button.getAttribute("aria-label")).toBe(label);
    expect(button.querySelector(".qa-promo-chip__full")?.textContent).toBe(label);
    expect(button.querySelector(".qa-promo-chip__short")?.textContent).toBe(short);
  });

  it("is grey while readiness loads, then takes the server's answer", async () => {
    let answer: (value: unknown) => void = () => undefined;
    setup(undefined);
    runs.promotion.mockReturnValue(new Promise((resolve) => { answer = resolve; }) as never);
    const container = await studio("qa");
    expect(chip(container).getAttribute("data-tone")).toBe("unknown");
    expect(chip(container).getAttribute("aria-label")).toBe("Checking production readiness");
    await act(async () => answer(readyWire()));
    await settle();
    expect(chip(container).getAttribute("data-tone")).toBe("ready");
  });

  it("is grey when readiness could not be read, with Try again in its popover", async () => {
    setup(undefined);
    runs.promotion.mockRejectedValue(apiErrorWith(500));
    const container = await studio("qa");
    expect(chip(container).getAttribute("data-tone")).toBe("unknown");
    await click(chip(container));
    expect(popover(container).textContent).toContain("Production readiness could not be loaded.");
    runs.promotion.mockResolvedValue(readyWire() as never);
    await click([...popover(container).querySelectorAll("button")].find((b) => b.textContent === "Try again"));
    expect(chip(container).getAttribute("data-tone")).toBe("ready");
  });

  it("renders nothing for a backend without the promotion route, and the run column still renders", async () => {
    setup(undefined);
    runs.promotion.mockRejectedValue(apiErrorWith(404));
    const container = await studio("lead");
    expect(container.querySelector(".qa-promo-chip")).toBeNull();
    expect(mergeButton(container)).toBeNull();
    expect(container.querySelector(".qa-run-card")).not.toBeNull();
  });
});

describe("QA Studio — the readiness popover", () => {
  it("opens under the chip with everything the strip showed: route, rows, reasons, PR, who merges", async () => {
    setup(promotionWire());
    const container = await studio("qa");
    const button = chip(container);
    const panel = popover(container);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    await click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute("role")).toBe("group");
    expect(document.getElementById(panel.getAttribute("aria-labelledby")!)?.textContent).toBe("Not ready for production");
    expect(panel.textContent).toContain("uat @ 9f8e7d6 → main");
    expect(panel.textContent).toContain("1 of 2 checklists approved");
    const rows = [...panel.querySelectorAll("li.qa-promo__row")].map((row) => row.textContent);
    expect(rows[0]).toContain("Release smoke test");
    expect(rows[0]).toContain("Approved for this commit");
    expect(rows[1]).toContain("Accessibility pass");
    expect(rows[1]).toContain("Not verified on this commit yet");
    expect(panel.querySelector(".qa-promo__reasons")?.textContent).toContain("Accessibility pass has no QA run on uat @ 9f8e7d6.");
    // The promotion PR is named, never linked: ALPHACI is the only UI.
    expect(panel.querySelector(".qa-promo__pr")?.textContent).toBe("Promotion PR #42");
    expect(panel.querySelector("a")).toBeNull();
    expect(panel.textContent).toContain("Product owners merge uat into main once every checklist is approved.");
    // Focus stays on the chip: a disclosure, not a menu.
    expect(document.activeElement).not.toBe(panel);
  });

  it("closes on Escape and gives focus back to the chip", async () => {
    setup(promotionWire());
    const container = await studio("qa");
    await click(chip(container));
    const inside = popover(container);
    await key(inside, "Escape");
    expect(popover(container).hidden).toBe(true);
    expect(chip(container).getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(chip(container));
  });

  it("keeps Escape from leaving full screen while it closes the popover", async () => {
    setup(promotionWire());
    const container = await studio("qa");
    await click(container.querySelector('button[aria-label="Full screen"]'));
    await click(container.querySelector("button.qa-launcher"));
    await click(chip(container));
    await key(chip(container), "Escape");
    expect(popover(container).hidden).toBe(true);
    expect(container.querySelector(".qa-studio")?.getAttribute("data-full-screen")).toBe("true");
  });

  it("closes on a press outside, without taking focus", async () => {
    setup(promotionWire());
    const container = await studio("qa");
    await click(chip(container));
    const outside = container.querySelector<HTMLElement>(".qa-colpanel")!;
    await act(async () => {
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(popover(container).hidden).toBe(true);
    // A press inside the popover keeps it open.
    await click(chip(container));
    await act(async () => {
      popover(container).dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(popover(container).hidden).toBe(false);
  });

  it("closes when focus moves out of the chip and its popover", async () => {
    setup(promotionWire());
    const container = await studio("qa");
    chip(container).focus();
    await click(chip(container));
    const tab = container.querySelector<HTMLButtonElement>('[role="tab"]')!;
    await act(async () => {
      tab.focus();
    });
    expect(popover(container).hidden).toBe(true);
  });
});

describe("QA Studio — Merge to main beside the chip", () => {
  it("lead, not ready: a disabled Merge to main whose reason is announced with the popover closed", async () => {
    setup(promotionWire());
    const container = await studio("lead");
    const button = mergeButton(container)!;
    expect(button.disabled).toBe(true);
    expect(popover(container).hidden).toBe(true);
    const why = document.getElementById(button.getAttribute("aria-describedby")!)!;
    expect(why.textContent).toBe("Merging opens once every shared checklist is signed off Approved on uat @ 9f8e7d6.");
    // In the page, not inside the closed popover.
    expect(popover(container).contains(why)).toBe(false);
    expect(why.closest("[hidden]")).toBeNull();
    // The popover says it too, for anyone who opens it.
    expect(popover(container).querySelector(".qa-promo__why")?.textContent).toBe(why.textContent);
  });

  it("QA Team sees the status read-only: no Merge button, who merges instead", async () => {
    setup(readyWire());
    const container = await studio("qa");
    expect(mergeButton(container)).toBeNull();
    expect(container.querySelector(".qa-coltabs-bar__action")?.children).toHaveLength(0);
  });

  it("no button when the server withholds canMerge, even for a lead", async () => {
    setup(readyWire({ canMerge: false }));
    const container = await studio("lead");
    expect(mergeButton(container)).toBeNull();
  });

  it("confirms before merging, then shows the outcome under the tab bar without opening the popover", async () => {
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
    // The confirmation is not inside the tab bar (a size container is a containing block).
    expect(container.querySelector(".qa-coltabs-bar")?.contains(dialog())).toBe(false);
    expect(runs.mergePromotion).not.toHaveBeenCalled();
    await click(dialogButton("Merge to main"));
    expect(runs.mergePromotion).toHaveBeenCalledWith("project-1");
    expect(dialogButton("Merge to main")).toBeUndefined();
    const outcome = container.querySelector(".qa-promo-outcome")!;
    expect(outcome.getAttribute("data-tone")).toBe("success");
    expect(outcome.textContent).toContain("Merged into main");
    expect(outcome.textContent).toContain("main updated · merge commit 5555555");
    // In view: in the run column's live region under the bar, not in the closed popover.
    expect(popover(container).hidden).toBe(true);
    expect(popover(container).contains(outcome)).toBe(false);
    const live = outcome.closest('[role="status"]')!;
    expect(live.parentElement?.classList.contains("qa-studio__run")).toBe(true);
    expect(live.previousElementSibling?.classList.contains("qa-coltabs-bar")).toBe(true);
    expect(runs.promotion).toHaveBeenCalledTimes(2);
    expect(mergeButton(container)!.disabled).toBe(true);
    await click([...outcome.querySelectorAll("button")].find((b) => b.textContent === "Dismiss"));
    expect(container.querySelector(".qa-promo-outcome")).toBeNull();
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

  it("no longer remembers a folded strip per viewer", async () => {
    setup(readyWire());
    const container = await studio("lead");
    await click(chip(container));
    await click(chip(container));
    expect(window.localStorage.getItem("alphaci.qa-studio.promotion-card.collapsed")).toBeNull();
  });

  it("is mounted once and moves with the run column into the full-screen drawer, under its header", async () => {
    setup(readyWire(), runAs("lead", { branch: "uat", items: [runItem(0)] }));
    const container = await studio("lead");
    const before = chip(container);
    const runCard = container.querySelector(".qa-run-card");
    await click(container.querySelector('button[aria-label="Full screen"]'));
    await click(container.querySelector("button.qa-launcher"));
    const drawer = container.querySelector('[role="region"]')!;
    expect(drawer.contains(before)).toBe(true);
    expect(container.querySelectorAll(".qa-coltabs-bar")).toHaveLength(1);
    expect(container.querySelectorAll(".qa-promo-chip")).toHaveLength(1);
    expect(container.querySelectorAll("button.qa-promo__merge")).toHaveLength(1);
    expect(chip(container)).toBe(before);
    expect(drawer.querySelector(".qa-drawer__head")?.nextElementSibling?.classList.contains("qa-coltabs-bar")).toBe(true);
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
    expect(chip(container).getAttribute("aria-label")).toBe("Ready for production");
  });
});

describe("QA Studio — a delivered iteration (Iterations phase 2)", () => {
  const delivered = {
    scope: "project",
    eligible: false,
    canMerge: true,
    iterationDelivered: true,
    repositoryDelivered: true,
    iteration: { id: "it-3", number: 3, status: "delivered", deliveredAt: "2026-10-14T10:00:00.000Z" },
  };

  it("turns the chip violet and names the iteration; Merge to main is gone", async () => {
    setup(readyWire(delivered));
    const container = await studio("lead");
    expect(chip(container).getAttribute("data-tone")).toBe("delivered");
    expect(chip(container).getAttribute("aria-label")).toBe("Iteration 3 delivered");
    expect(mergeButton(container)).toBeNull();
    expect(popover(container).textContent).not.toContain("What blocks the merge");
    expect(popover(container).querySelector(".qa-promo__delivered")?.textContent).toMatch(/^Iteration 3 delivered on /);
  });

  it("reads 'main already contains this commit' as a success, never GitHub refusing", async () => {
    setup(readyWire({ repositoryDelivered: false }));
    runs.mergePromotion.mockResolvedValue({ merged: false, how: "already_in_main", message: "main already contains this commit" } as never);
    const container = await studio("lead");
    await click(mergeButton(container));
    await click(dialogButton("Merge to main"));
    const outcome = container.querySelector(".qa-promo-outcome")!;
    expect(outcome.getAttribute("data-tone")).toBe("success");
    expect(outcome.textContent).toContain("Already in main");
    expect(outcome.textContent).toContain("main already contains this commit");
    expect(outcome.textContent).not.toContain("GitHub refused the merge");
  });
});
