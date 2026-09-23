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
});
