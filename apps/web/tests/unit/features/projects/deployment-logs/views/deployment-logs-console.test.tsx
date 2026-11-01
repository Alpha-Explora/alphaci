import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DeploymentLogsConsole } from "../../../../../../src/features/projects/deployment-logs";
import { timeZoneAbbreviation } from "../../../../../../src/features/projects/deployment-logs/model/log-format";
import { FakeEventSource, line, page } from "../log-fixtures";

describe("DeploymentLogsConsole", () => {
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

  function render(deployWindow: { startTime: string; endTime: string | null } | null) {
    act(() => {
      root.render(
        <DeploymentLogsConsole
          deployWindow={deployWindow}
          projectId="proj-1"
          providerLabel="Render"
          targetId="target-api"
          targetName="alphaci-api"
        />,
      );
    });
  }

  function select(label: string) {
    return container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  }

  function change(element: HTMLSelectElement | null, value: string) {
    if (!element) throw new Error("no such control");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("renders the lines, scoped to this deploy, with only the provider's filters", () => {
    render({ startTime: "2026-09-24T09:59:00.000Z", endTime: null });

    const stream = FakeEventSource.latest();
    expect(stream.params.get("startTime")).toBe("2026-09-24T09:59:00.000Z");
    expect(select("Time range")?.value).toBe("deploy");

    act(() =>
      stream.emit({
        kind: "snapshot",
        ...page([line("a", 1), line("b", 2, { level: "error" })], { filters: ["type", "level"] }),
      }),
    );

    expect(container.querySelectorAll(".deploy-logs__line")).toHaveLength(2);
    expect(select("Log type")).not.toBeNull();
    expect(container.textContent).toContain("Errors only (1)");
    // The provider did not list text search, so there is no search box.
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(container.textContent).toMatch(/Times in \S+/);
  });

  it("has no paid add-on pointers, and names the viewer's own timezone", () => {
    const window = { startTime: "2026-01-15T09:59:00.000Z", endTime: null };
    render(window);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/log stream integration/i);
    expect(text).not.toMatch(/CLI|MCP/);
    // From Intl on the viewer's machine, at the window's own date.
    expect(text).toContain(`Times in ${timeZoneAbbreviation(new Date(window.startTime))}`);
  });

  it("starts on the last hour with no deploy, and reopens on a type or range change", () => {
    render(null);
    expect(select("Time range")?.value).toBe("1h");
    expect(Array.from(select("Time range")?.options ?? []).some((o) => o.value === "deploy")).toBe(false);
    const first = FakeEventSource.latest();

    change(select("Log type"), "build");
    const typed = FakeEventSource.latest();
    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(typed.params.get("type")).toBe("build");

    change(select("Time range"), "15m");
    const ranged = FakeEventSource.latest();
    expect(ranged).not.toBe(typed);
    expect(ranged.params.get("type")).toBe("build");
  });

  describe("provider rate limiting", () => {
    const LIVE = { startTime: "2026-09-24T09:59:00.000Z", endTime: null };

    afterEach(() => {
      jest.useRealTimers();
    });

    function notice(): HTMLElement | null {
      return [...container.querySelectorAll<HTMLElement>(".deploy-logs__notice")].find((el) =>
        el.textContent?.includes("limiting log reads"),
      ) ?? null;
    }

    it("keeps the lines, counts down quietly, and clears on the next append", () => {
      jest.useFakeTimers();
      render(LIVE);
      const stream = FakeEventSource.latest();
      act(() => stream.emit({ kind: "snapshot", ...page([line("a", 1), line("b", 2)]) }));
      act(() => stream.emit({ kind: "status", source: "live", rateLimited: true, retryAfterMs: 30_000 }));

      expect(notice()?.textContent).toBe("Render is limiting log reads · retrying in 30s");
      expect(notice()?.classList.contains("deploy-logs__notice--danger")).toBe(false);
      expect(container.textContent).not.toContain("unavailable");
      expect(container.querySelectorAll(".deploy-logs__line")).toHaveLength(2);

      act(() => {
        jest.advanceTimersByTime(12_000);
      });
      expect(notice()?.textContent).toContain("retrying in 18s");

      act(() => stream.emit({ kind: "append", source: "live", logs: [line("c", 3)] }));
      expect(notice()).toBeNull();
      expect(container.querySelectorAll(".deploy-logs__line")).toHaveLength(3);
    });

    it("shows the friendly text, not the raw JSON, for an older backend's 429", () => {
      render(LIVE);
      const stream = FakeEventSource.latest();
      act(() =>
        stream.emit({
          source: "unavailable",
          reason: 'Render logs could not be loaded: 429 {"message": "rate limit exceeded"}',
          logs: [],
        }),
      );
      const text = container.textContent ?? "";
      expect(text).toContain("The host is rate-limiting log reads right now. Retry in a minute.");
      expect(text).not.toContain("rate limit exceeded");
      const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry");
      expect(retry).toBeDefined();

      const before = FakeEventSource.instances.length;
      act(() => retry?.click());
      expect(FakeEventSource.instances.length).toBe(before + 1);
    });

    it("still shows other provider failures as unavailable", () => {
      render(LIVE);
      act(() => FakeEventSource.latest().emit({ source: "unavailable", reason: "Render returned 503", logs: [] }));
      expect(container.textContent).toContain("Render logs are unavailable.");
      expect(container.textContent).toContain("Render returned 503");
    });
  });
});
