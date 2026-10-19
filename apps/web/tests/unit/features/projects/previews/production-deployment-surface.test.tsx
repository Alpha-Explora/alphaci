import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProductionDeploymentView } from "../../../../../src/features/projects/previews";
import type { ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { FakeEventSource, line, page } from "../deployment-logs/log-fixtures";

/*
 * Which media the Production Deployment card shows. The backend picks the
 * surface; the card only looks it up, and an older backend (no field) gets
 * the page it always had.
 */
function production(overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch: "main",
    isProduction: true,
    deploymentId: "dep-1",
    targetId: "target-api",
    targetName: "alphaci-api",
    provider: "render",
    status: "ready",
    commitSha: "4b84b6b0c1d",
    commitMessage: "fix(api): retry the provider",
    pullRequestNumber: null,
    previewUrl: "https://alphaci-api.onrender.com",
    inspectorUrl: "https://dashboard.render.com/web/srv-1/deploys/dep-1",
    createdAt: "2026-09-24T09:59:00.000Z",
    readyAt: "2026-09-24T10:02:00.000Z",
    embeddable: false,
    embedBlockedReason: null,
    ...overrides,
  };
}

const LOGS: Partial<ProjectBranchPreview> = {
  slot: "backend",
  surface: "logs",
  providerLabel: "Render",
  logsAvailable: true,
  logWindow: { startTime: "2026-09-24T09:59:00.000Z", endTime: null },
};

describe("Production Deployment card surface", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    FakeEventSource.install();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(preview: ProjectBranchPreview, onOpenFullLogs?: jest.Mock) {
    act(() => {
      root.render(
        <ProductionDeploymentView
          error={null}
          onOpenFullLogs={onOpenFullLogs}
          previews={{ enabled: true, liveProvidersEnabled: true, branches: [preview], providerError: null }}
          projectId="proj-1"
          status="ready"
        />,
      );
    });
  }

  function text() {
    return container.textContent ?? "";
  }

  it("shows a backend's live logs in place of the thumbnail, with no frame", () => {
    render(production(LOGS));

    expect(container.querySelector("iframe")).toBeNull();
    expect(text()).not.toContain("Loading preview");
    expect(container.querySelector("article")?.getAttribute("data-surface")).toBe("logs");
    const stream = FakeEventSource.latest();
    expect(stream.url).toContain("/projects/proj-1/deployment-targets/target-api/logs/stream");
    expect(stream.params.get("startTime")).toBe(LOGS.logWindow?.startTime);

    act(() =>
      stream.emit({
        kind: "snapshot",
        ...page([
          line("b1", 1, { type: "build", instance: null, message: "==> Build successful" }),
          line("a1", 2, { message: "Listening on :10000" }),
          line("a2", 3, { level: "error", message: "TypeError: x is undefined" }),
          line("a3", 4, { level: "warn", message: "slow query" }),
        ]),
      }),
    );

    const rows = Array.from(container.querySelectorAll(".deploy-logs__line"));
    expect(rows.map((row) => row.getAttribute("data-level"))).toEqual(["info", "info", "error", "warn"]);
    expect(rows[0]?.textContent).toContain("==> Build successful");
    expect(rows[0]?.querySelector(".deploy-logs__instance")).toBeNull();
    expect(rows[1]?.textContent).toContain("[x2k4j]");
    expect(rows[2]?.className).toContain("deploy-logs__line--danger");
    expect(rows[3]?.className).toContain("deploy-logs__line--warning");
    expect(text()).toContain("Live");
    expect(text()).toContain("Errors (1)");
    expect(text()).toContain("Render · alphaci-api");
  });

  it("shows one environment at a time: Production first, UAT behind its tab, with recent deploys folded", () => {
    const uat = production({
      ...LOGS,
      branch: "uat",
      isProduction: false,
      targetId: "target-api-uat",
      targetName: "alphaci-api-uat",
      trigger: "api",
      startedAt: "2026-09-24T09:59:04.000Z",
      readyAt: "2026-09-24T09:59:25.000Z",
      recentDeploys: [
        {
          id: "dep-2",
          status: "ready",
          commitSha: "b0f1855e663b",
          commitMessage: "fix(a11y): labels",
          trigger: "api",
          createdAt: "2026-09-24T09:59:00.000Z",
          startedAt: "2026-09-24T09:59:04.000Z",
          readyAt: "2026-09-24T09:59:25.000Z",
        },
        {
          id: "dep-1",
          status: "superseded",
          commitSha: "b0f1855e663b",
          commitMessage: "fix(a11y): labels",
          trigger: "api",
          createdAt: "2026-09-24T09:58:00.000Z",
          startedAt: null,
          readyAt: "2026-09-24T09:58:34.000Z",
        },
      ],
    });
    act(() => {
      root.render(
        <ProductionDeploymentView
          error={null}
          previews={{ enabled: true, liveProvidersEnabled: true, branches: [production(LOGS), uat], providerError: null }}
          projectId="proj-1"
          status="ready"
        />,
      );
    });

    const titles = () => Array.from(container.querySelectorAll(".deploy-card__title")).map((node) => node.textContent);
    const tabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(titles()).toEqual(["Production Deployment"]);
    expect(container.querySelector(".active-branch")).toBeNull();
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Productionmain · live", "UATuat · live"]);
    expect(tabs().map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    expect(FakeEventSource.latest().url).toContain("/deployment-targets/target-api/logs/stream");

    act(() => tabs()[1]?.click());
    expect(titles()).toEqual(["UAT Deployment"]);
    expect(tabs()[1]?.getAttribute("tabindex")).toBe("0");
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(tabs()[1]?.id);
    expect(FakeEventSource.latest().url).toContain("/deployment-targets/target-api-uat/logs/stream");

    act(() => {
      tabs()[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(titles()).toEqual(["Production Deployment"]);
    act(() => tabs()[1]?.click());

    const card = container.querySelector("article") as HTMLElement;
    expect(card.textContent).toContain("Took21s");
    expect(card.textContent).toContain("TriggerAPI");
    const toggle = card.querySelector<HTMLButtonElement>(".deploy-card__recent-toggle");
    const list = card.querySelector<HTMLElement>(".deploy-card__deploys");
    expect(toggle?.textContent).toBe("Recent deploys (2)");
    expect(list?.hidden).toBe(true);
    act(() => toggle?.click());
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(list?.hidden).toBe(false);
    const rows = Array.from(list?.querySelectorAll("li") ?? []).map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("Live");
    expect(rows[0]).toContain("b0f1855");
    expect(rows[0]).toContain("fix(a11y): labels");
    expect(rows[0]).toContain("API · 21s");
    expect(rows[1]).toContain("Replaced");
  });

  it("puts Source on the top row, beside the first address", () => {
    const labels = () =>
      Array.from(container.querySelectorAll(".deploy-card__facts dt")).map((node) => node.textContent);

    render(production({ ...LOGS, deploymentUrl: "https://alphaci-api-dpl.onrender.com" }));
    expect(labels().slice(0, 3)).toEqual(["Deployment", "Source", "Domains"]);
    const source = container.querySelectorAll(".deploy-card__fact")[1];
    expect(source?.classList.contains("deploy-card__fact--wide")).toBe(false);
    expect(source?.textContent).toContain("main");
    expect(source?.textContent).toContain("4b84b6b");

    render(production(LOGS));
    expect(labels().slice(0, 2)).toEqual(["Domains", "Source"]);
  });

  it("says a live tail that has gone quiet may be a sleeping service", () => {
    render(production(LOGS));
    act(() => FakeEventSource.latest().emit({ kind: "snapshot", ...page([line("a", 1)]) }));

    expect(container.querySelector(".deploy-logs-tail__quiet")?.textContent).toContain("No new lines since");
    expect(text()).toContain("starts again on the next request");
  });

  it("toggles errors only from the chip, as a server-side filter", () => {
    render(production(LOGS));
    act(() => FakeEventSource.latest().emit({ kind: "snapshot", ...page([line("a", 1, { level: "error" })]) }));

    const chip = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Errors (1)");
    expect(chip?.getAttribute("aria-pressed")).toBe("false");
    act(() => chip?.click());
    expect(FakeEventSource.latest().params.get("level")).toBe("error");
  });

  it("opens the full logs for this target and deploy", () => {
    const onOpen = jest.fn();
    render(production(LOGS), onOpen);

    const open = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Open full logs");
    act(() => open?.click());
    expect(onOpen).toHaveBeenCalledWith({ targetId: "target-api", window: LOGS.logWindow });
  });

  it("keeps the page thumbnail for a frontend", () => {
    render(
      production({
        provider: "vercel",
        slot: "frontend",
        surface: "page",
        providerLabel: "Vercel",
        embeddable: true,
        previewUrl: "https://web.vercel.app",
      }),
    );
    expect(container.querySelector("article")?.getAttribute("data-surface")).toBe("page");
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://web.vercel.app");
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("falls back to the page, and the old label, when the backend predates the field", () => {
    render(production({ embeddable: true }));
    expect(container.querySelector("article")?.getAttribute("data-surface")).toBe("page");
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(text()).toContain("Render · alphaci-api");
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("shows the not-deployed state for a logs surface with no window", () => {
    render(
      production({
        ...LOGS,
        status: "not_deployed",
        deploymentId: null,
        createdAt: null,
        logWindow: null,
      }),
    );
    expect(text()).toContain("Nothing has been deployed here yet");
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("names a provider that did not answer, and shows no lines", () => {
    render(production(LOGS));
    act(() =>
      FakeEventSource.latest().emit({
        kind: "snapshot",
        ...page([], { source: "unavailable", reason: "Render returned 503." }),
      }),
    );
    expect(text()).toContain("Render logs are unavailable.");
    expect(text()).toContain("Render returned 503.");
    expect(container.querySelectorAll(".deploy-logs__line")).toHaveLength(0);
    expect(container.querySelector(".deploy-logs__badge--live")).toBeNull();
    expect(container.querySelector(".deploy-logs__badge")?.textContent).toBe("Unavailable");
  });

  it("badges simulated lines and never calls them live", () => {
    render(production(LOGS));
    act(() =>
      FakeEventSource.latest().emit({
        kind: "snapshot",
        ...page([line("a", 1)], { source: "simulated", reason: "Live providers are disabled." }),
      }),
    );
    expect(text()).toContain("Simulated (local mock)");
    expect(container.querySelector(".deploy-logs__badge--live")).toBeNull();
    expect(text()).toContain("Live providers are disabled.");
  });
});
