/**
 * Unit tests for useCurrentProjectsTour hook.
 *
 * Uses the same Probe + createRoot pattern as use-onboarding-tour.test.tsx
 * to avoid multiple-React-instance issues with @testing-library/react
 * renderHook in this project's jest environment.
 */

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useCurrentProjectsTour } from "../../src/features/workflows/studio/view-models/use-current-projects-tour";
import type { AuthMeResponse } from "../../src/shared/api/contracts";

/* ── Mocks ───────────────────────────────────────────────────────────────── */

jest.mock("../../src/features/auth/session/data/auth-api", () => ({
  completeOnboarding: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("driver.js/dist/driver.css", () => ({}), { virtual: true });

const mockDrive = jest.fn();
const mockDestroy = jest.fn();
let capturedOnFinished: (() => void) | undefined;

jest.mock("../../src/features/workflows/studio/views/tours/current-projects-tour", () => ({
  createCurrentProjectsTour: jest.fn(
    (callbacks: { onFinished: () => void }) => {
      capturedOnFinished = callbacks.onFinished;
      return { drive: mockDrive, destroy: mockDestroy };
    },
  ),
}));

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
  } as unknown as AuthMeResponse;
}

interface HookOptions {
  session: AuthMeResponse | null;
  guest: boolean;
  isCurrentTabActive: boolean;
  onboardingCompleted?: boolean;
}

interface HookSnapshot {
  startTour: () => void;
  tourDone: boolean;
}

let latestSnapshot: HookSnapshot | null = null;

function Probe(props: HookOptions) {
  const result = useCurrentProjectsTour(props);
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

describe("useCurrentProjectsTour", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latestSnapshot = null;
    capturedOnFinished = undefined;
    mockTourParam = null;
    mockDrive.mockClear();
    mockDestroy.mockClear();

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
    jest.restoreAllMocks();
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
      isCurrentTabActive: true,
      onboardingCompleted: false,
    });
    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not auto-launch when session is null", async () => {
    await mount({
      session: null,
      guest: false,
      isCurrentTabActive: true,
      onboardingCompleted: false,
    });
    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not auto-launch when onboardingCompleted=true", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isCurrentTabActive: true,
      onboardingCompleted: true,
    });
    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not auto-launch when the Current tab is not active", async () => {
    await mount({
      session: makeSession(false),
      guest: false,
      isCurrentTabActive: false,
      onboardingCompleted: false,
    });
    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("exposes startTour which launches the tour on demand", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isCurrentTabActive: true,
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
      isCurrentTabActive: true,
      onboardingCompleted: true,
    });

    await act(async () => {
      latestSnapshot?.startTour();
      await flushMicrotasks(5);
    });

    await act(async () => {
      capturedOnFinished?.();
    });

    await waitForCondition(() => latestSnapshot?.tourDone === true);
    expect(latestSnapshot?.tourDone).toBe(true);
  });

  it("returns tourDone=false initially", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isCurrentTabActive: true,
      onboardingCompleted: true,
    });
    expect(latestSnapshot?.tourDone).toBe(false);
  });

  it("auto-launches via ?tour=2 even when onboardingCompleted=true", async () => {
    mockTourParam = "2";
    await mount({
      session: makeSession(true),
      guest: false,
      isCurrentTabActive: true,
      onboardingCompleted: true,
    });

    await waitForCondition(() => mockDrive.mock.calls.length > 0);
    expect(mockDrive).toHaveBeenCalled();
  });

  it("does not replay via ?tour=2 when Current tab is not active", async () => {
    mockTourParam = "2";
    await mount({
      session: makeSession(true),
      guest: false,
      isCurrentTabActive: false,
      onboardingCompleted: true,
    });
    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("does not replay via ?tour=2 for a guest", async () => {
    mockTourParam = "2";
    await mount({
      session: null,
      guest: true,
      isCurrentTabActive: true,
      onboardingCompleted: true,
    });
    await flushMicrotasks(5);
    expect(mockDrive).not.toHaveBeenCalled();
  });

  it("auto-launches once when every condition is satisfied", async () => {
    await mount({
      session: makeSession(false),
      guest: false,
      isCurrentTabActive: true,
      onboardingCompleted: false,
    });

    await waitForCondition(() => mockDrive.mock.calls.length > 0);
    expect(mockDrive).toHaveBeenCalledTimes(1);
  });

  it("destroys the previous driver instance when startTour is called again", async () => {
    await mount({
      session: makeSession(true),
      guest: false,
      isCurrentTabActive: true,
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
