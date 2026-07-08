/**
 * Unit tests for src/lib/theme-context.tsx.
 *
 * Uses the same Probe + createRoot pattern as the onboarding-tour hook
 * tests in this project to avoid multiple-React-instance issues with
 * @testing-library/react's renderHook in this jest environment.
 */

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ThemeProvider, useTheme } from "../../src/lib/theme-context";

interface Snapshot {
  theme: "dark" | "light";
  toggle: () => void;
}

let latestSnapshot: Snapshot | null = null;

function Probe() {
  const result = useTheme();
  useEffect(() => {
    latestSnapshot = result;
  });
  return null;
}

describe("ThemeProvider / useTheme", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latestSnapshot = null;
    document.documentElement.removeAttribute("data-theme");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("defaults to dark theme and sets the data-theme attribute on mount", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    expect(latestSnapshot?.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggle flips from dark to light and updates the DOM attribute", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    await act(async () => {
      latestSnapshot?.toggle();
    });

    expect(latestSnapshot?.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("toggle flips back from light to dark on a second call", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    await act(async () => {
      latestSnapshot?.toggle();
    });
    expect(latestSnapshot?.theme).toBe("light");

    await act(async () => {
      latestSnapshot?.toggle();
    });

    expect(latestSnapshot?.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("useTheme falls back to the default context value outside a provider", () => {
    // The context default is { theme: "dark", toggle: () => {} } — verify a
    // consumer rendered without ThemeProvider gets that default rather than
    // throwing, and that calling the default toggle is a safe no-op.
    let outsideSnapshot: Snapshot | null = null;
    function OutsideProbe() {
      const result = useTheme();
      useEffect(() => {
        outsideSnapshot = result;
      });
      return null;
    }

    const outsideContainer = document.createElement("div");
    document.body.appendChild(outsideContainer);
    const outsideRoot = createRoot(outsideContainer);

    act(() => {
      outsideRoot.render(<OutsideProbe />);
    });

    expect(outsideSnapshot?.theme).toBe("dark");
    expect(() => outsideSnapshot?.toggle()).not.toThrow();

    act(() => {
      outsideRoot.unmount();
    });
    outsideContainer.remove();
  });
});
