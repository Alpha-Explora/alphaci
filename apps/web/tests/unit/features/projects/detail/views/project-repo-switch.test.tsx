import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectRepoSwitch } from "../../../../../../src/features/projects/detail/views/project-repo-switch";
import type { ProjectDetailTab } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { RepoSwitchOption } from "../../../../../../src/features/projects/detail/model/project-folder-types";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function option(overrides: Partial<RepoSwitchOption>): RepoSwitchOption {
  return {
    key: "proj-fe",
    projectId: "proj-fe",
    role: "frontend",
    roleLabel: "FRONTEND",
    label: "shop-fe",
    showName: false,
    repoFullName: "Org/shop-fe",
    current: false,
    disabled: false,
    ...overrides,
  };
}

const OPTIONS: RepoSwitchOption[] = [
  option({ current: true }),
  option({ key: "worker", projectId: null, role: null, roleLabel: "REPO", label: "shop-worker", repoFullName: null, disabled: true }),
  option({ key: "proj-be", projectId: "proj-be", role: "backend", roleLabel: "BACKEND", label: "shop-be", repoFullName: "Org/shop-be" }),
  option({ key: "proj-svc", projectId: "proj-svc", role: "service", roleLabel: "SERVICE", label: "shop-svc", repoFullName: "Org/shop-svc" }),
];

let root: Root | null = null;
let container: HTMLElement;

function render(currentTab: ProjectDetailTab = "hosting", visibleTabs: ProjectDetailTab[] = ["overview", "hosting"]) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <ProjectRepoSwitch options={OPTIONS} projectName="shop" currentTab={currentTab} visibleTabs={visibleTabs} />,
    );
  });
}

function radios(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
}

function press(target: HTMLElement, key: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

describe("ProjectRepoSwitch", () => {
  it("is a labelled radio group, one option per repository with its role", () => {
    render();
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute("aria-label")).toBe("Repositories in shop");
    expect(radios().map((radio) => radio.textContent)).toEqual([
      "FRONTENDshop-fe",
      "REPOshop-worker",
      "BACKENDshop-be",
      "SERVICEshop-svc",
    ]);
    expect(radios().map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false"]);
    expect(radios().map((radio) => radio.dataset.role ?? null)).toEqual(["frontend", null, "backend", "service"]);
    expect(radios().some((radio) => radio.dataset.showName !== undefined)).toBe(false);
  });

  it("marks the options that must show their name", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <ProjectRepoSwitch
          options={[
            option({ current: true, showName: true }),
            option({ key: "proj-fe-2", projectId: "proj-fe-2", label: "shop-fe-2", showName: true }),
            option({ key: "proj-be", projectId: "proj-be", role: "backend", roleLabel: "BACKEND", label: "shop-be" }),
          ]}
          projectName="shop"
          currentTab="hosting"
          visibleTabs={["overview", "hosting"]}
        />,
      );
    });
    expect(radios().map((radio) => radio.dataset.showName ?? null)).toEqual(["true", "true", null]);
  });

  it("gives the group one tab stop, on the page on screen", () => {
    render();
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it("explains a repository with no AlphaCI project, and will not open it", () => {
    render();
    const unlinked = radios()[1];
    expect(unlinked.getAttribute("aria-disabled")).toBe("true");
    expect(unlinked.dataset.tooltip).toBe("Not linked to an AlphaCI project yet");
    const hint = document.getElementById(unlinked.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toBe("Not linked to an AlphaCI project yet");
    expect(hint?.hidden).toBe(true);
    act(() => unlinked.click());
    expect(push).not.toHaveBeenCalled();
    // Linked options carry no description.
    expect(radios()[2].hasAttribute("aria-describedby")).toBe(false);
  });

  it("moves focus with the arrows, skipping the disabled option and wrapping", () => {
    render();
    const [fe, , be, svc] = radios();
    act(() => fe.focus());
    press(fe, "ArrowRight");
    expect(document.activeElement).toBe(be);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, 0, -1]);
    press(be, "ArrowDown");
    expect(document.activeElement).toBe(svc);
    press(svc, "ArrowRight");
    expect(document.activeElement).toBe(fe);
    press(fe, "ArrowLeft");
    expect(document.activeElement).toBe(svc);
    press(svc, "ArrowUp");
    expect(document.activeElement).toBe(be);
    press(be, "ArrowLeft");
    expect(document.activeElement).toBe(fe);
    press(fe, "End");
    expect(document.activeElement).toBe(svc);
    press(svc, "Home");
    expect(document.activeElement).toBe(fe);
    // Arrows only move focus: nothing opened.
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores keys it does not own", () => {
    render();
    const [fe] = radios();
    act(() => fe.focus());
    press(fe, "a");
    expect(document.activeElement).toBe(fe);
  });

  it("opens a sibling on the same tab", () => {
    render("hosting", ["overview", "hosting"]);
    act(() => radios()[2].click());
    expect(push).toHaveBeenCalledWith("/projects/proj-be#hosting");
    expect(radios()[2].dataset.pending).toBe("true");
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute("aria-busy")).toBe("true");
  });

  it("falls back to Overview when the tab is not shown", () => {
    render("qa", ["overview", "hosting"]);
    act(() => radios()[3].click());
    expect(push).toHaveBeenCalledWith("/projects/proj-svc#overview");
  });

  it("does nothing for the page already on screen", () => {
    render();
    act(() => radios()[0].click());
    expect(push).not.toHaveBeenCalled();
    expect(radios()[0].dataset.pending).toBeUndefined();
  });
});
