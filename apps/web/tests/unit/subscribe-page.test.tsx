import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import SubscribePage from "../../src/app/subscribe/page";
import { useAuthSession } from "../../src/hooks/use-auth-session";
import type { AuthMeResponse } from "../../src/lib/api/contracts";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/subscribe",
  useRouter: () => ({
    replace: replaceMock,
    push: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react");

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      span: ({
        children,
        layoutId: _layoutId,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        style,
        ...props
      }: React.HTMLAttributes<HTMLSpanElement> & {
        layoutId?: unknown;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
      }) => React.createElement("span", { ...props, style }, children),
      div: ({
        children,
        initial: _initial,
        whileInView: _whileInView,
        animate: _animate,
        exit: _exit,
        viewport: _viewport,
        transition: _transition,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        whileInView?: unknown;
        animate?: unknown;
        exit?: unknown;
        viewport?: unknown;
        transition?: unknown;
      }) => React.createElement("div", props, children),
    },
    useMotionValue: (initial: number) => ({ get: () => initial, set: jest.fn() }),
    useReducedMotion: () => true,
    useScroll: () => ({ scrollYProgress: { get: () => 0, set: jest.fn() } }),
    useSpring: (value: unknown) => value,
  };
});

jest.mock("../../src/components/layout/flow-background", () => ({
  FlowBackground: () => <div data-testid="flow-background" />,
}));

jest.mock("../../src/components/layout/pipeline-logo", () => ({
  PipelineLogo: () => <span data-testid="pipeline-logo" />,
}));

jest.mock("../../src/components/product/subscription-congrats-modal", () => ({
  SubscriptionCongratsModal: () => <div data-testid="subscription-congrats" />,
}));

jest.mock("../../src/hooks/use-auth-session", () => ({
  useAuthSession: jest.fn(),
}));

const mockedUseAuthSession = useAuthSession as jest.MockedFunction<typeof useAuthSession>;

const activeProSession: AuthMeResponse = {
  authenticated: true,
  user: {
    id: "user-1",
    login: "tone",
  },
  subscription: {
    plan: "pro",
    status: "active",
    provider: "mock",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

async function flushMicrotasks(cycles = 3) {
  for (let index = 0; index < cycles; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("SubscribePage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    replaceMock.mockClear();
    mockedUseAuthSession.mockReturnValue({
      status: "signed-in",
      session: activeProSession,
      error: null,
      refresh: jest.fn(),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it("keeps active paid users on the subscription page for billing management", async () => {
    await act(async () => {
      root.render(<SubscribePage />);
    });
    await flushMicrotasks();

    expect(replaceMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Current plan");
    expect(container.textContent).toContain("Pro Monthly");
    expect(container.textContent).toContain("Active paid plan");
    expect(container.textContent).toContain("Compare limits");
    expect(container.textContent).toContain("Cancel subscription");
  });

  it("shows public pricing for signed-out visitors instead of the app billing shell", async () => {
    mockedUseAuthSession.mockReturnValue({
      status: "signed-out",
      session: null,
      error: null,
      refresh: jest.fn(),
    });

    await act(async () => {
      root.render(<SubscribePage />);
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Plans for CI/CD builders");
    expect(container.textContent).toContain("Start free");
    expect(container.textContent).toContain("Get Pro");
    expect(container.textContent).toContain("Log in");
    expect(container.textContent).not.toContain("Plans & Billing");
    expect(container.textContent).not.toContain("Cancel subscription");
  });
});
