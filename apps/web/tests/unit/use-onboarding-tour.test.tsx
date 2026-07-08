import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useOnboardingTour } from "../../src/hooks/use-onboarding-tour";
import type { AuthMeResponse } from "../../src/lib/api/contracts";

/* ── Mocks ───────────────────────────────────────────────────────────────── */

// Prevent the auth API from making real network calls.
jest.mock("../../src/lib/api/auth", () => ({
  completeOnboarding: jest.fn().mockResolvedValue({ ok: true, onboardingCompleted: true }),
}));

// Mock driver.js CSS import (jsdom cannot process it).
jest.mock("driver.js/dist/driver.css", () => ({}), { virtual: true });

// Mock the tour builder so tests are not blocked on DOM element lookups.
const mockDrive = jest.fn();
const mockDestroy = jest.fn();
let capturedOnDestroyed: (() => void) | undefined;

jest.mock("../../src/lib/onboarding/create-project-tour", () => ({
  createProjectTour: jest.fn((callbacks: { onFinished: () => void }) => {
    // Capture the onDestroyed callback so tests can fire it manually.
    capturedOnDestroyed = callbacks.onFinished;
    return { drive: mockDrive, destroy: mockDestroy };
  }),
  getProjectTourSteps: jest.fn(() => []),
}));

// Mock next/navigation so the hook's useSearchParams() resolves in jsdom.
// `mockTourParam` is mutated per-test to simulate the ?tour=1 replay deep-link.
let mockTourParam: string | null = null;
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "tour" ? mockTourParam : null),
  }),
}));

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function makeSession(onboardingCompleted: boolean): AuthMeResponse {
  return {
    authenticated: true,
    user: {
      id: "u1",
      login: "tone",
      onboardingCompleted,
    },
    subscription: {
      plan: "pro",
      status: "active",
      provider: "mock",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

interface HookOptions {
  session: AuthMeResponse | null;
  guest: boolean;
  isSetupTabActive: boolean;
  onboardingCompleted?: boolean;
}

interface HookSnapshot {
  startTour: () => void;
  tourDone: boolean;
}

let latestSnapshot: HookSnapshot | null = null;

function Probe(props: HookOptions) {
  const result = useOnboardingTour(props);
  useEffect(() => {
    latestSnapshot = result;
  });
  return null;
}

async function flushMicrotasks(cycles = 3) {
  for (let i = 0; i < cycles; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function waitForCondition(condition: () => boolean, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    if (condition()) return;
    await flushMicrotasks();
  }
  throw new Error("Condition not met");
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe("useOnboardingTour", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latestSnapshot = null;
    capturedOnDestroyed = undefined;
    mockTourParam = null;
    mockDrive.mockClear();
    mockDestroy.mockClear();

    // The hook schedules tour launch inside requestAnimationFrame. jsdom's rAF
    // fires on a macrotask timer that microtask-flushing won't advance, so run
    // it synchronously for deterministic assertions.
    jest
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback): number => {
        cb(0);
        return 0;
      });
    jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => undefined);

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

  async function mount(props: HookOptions) {
    await act(async () => {
      root.render(<Probe {...props} />);
    });
    await waitForCondition(() => latestSnapshot !== null);
  }

  it("does not auto-launch when guest=true", async () => {
    await mount({
      session: makeSession(false),
      guest: true,
      isSetupTabActive: true,
      onboardingCompleted: false,
    });

    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not auto-launch when onboardingCompleted=true", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not auto-launch when session is null", async () => {
    await mount({
      session: null,
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: false,
    });

    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not auto-launch when the setup tab is not active", async () => {
    await mount({
      session: makeSession(false),
      guest: false,
      isSetupTabActive: false,
      onboardingCompleted: false,
    });

    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("exposes startTour which drives the tour", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    await act(async () => {
      latestSnapshot?.startTour();
      await flushMicrotasks(5);
    });

    expect(mockDrive).toHaveBeenCalledTimes(1);
  });

  it("sets tourDone to true once onFinished fires", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    await act(async () => {
      latestSnapshot?.startTour();
      await flushMicrotasks(5);
    });

    // Simulate driver completing/dismissing the tour.
    await act(async () => {
      capturedOnDestroyed?.();
    });

    await waitForCondition(() => latestSnapshot?.tourDone === true);
    expect(latestSnapshot?.tourDone).toBe(true);
  });

  it("returns tourDone=false initially", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    expect(latestSnapshot?.tourDone).toBe(false);
  });

  it("auto-launches via ?tour=1 even when onboardingCompleted=true", async () => {
    mockTourParam = "1";
    await mount({
      session: makeSession(true),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    await waitForCondition(() => mockDrive.mock.calls.length > 0);
    expect(mockDrive).toHaveBeenCalled();
  });

  it("does not replay via ?tour=1 for a guest", async () => {
    mockTourParam = "1";
    await mount({
      session: null,
      guest: true,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("auto-launches once when every condition is satisfied", async () => {
    await mount({
      session: makeSession(false),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: false,
    });

    await waitForCondition(() => mockDrive.mock.calls.length > 0);
    expect(mockDrive).toHaveBeenCalledTimes(1);
  });

  it("destroys the previous driver instance when startTour is called again", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isSetupTabActive: true,
      onboardingCompleted: true,
    });

    await act(async () => {
      latestSnapshot?.startTour();
      await flushMicrotasks(5);
    });
    expect(mockDrive).toHaveBeenCalledTimes(1);
    expect(mockDestroy).not.toHaveBeenCalled();

    await act(async () => {
      latestSnapshot?.startTour();
      await flushMicrotasks(5);
    });

    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(mockDrive).toHaveBeenCalledTimes(2);
  });
});
