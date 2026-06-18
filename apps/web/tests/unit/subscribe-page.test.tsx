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
  const React = jest.requireActual("react") as typeof import("react");

  // Strip framer-only props so any motion.<tag> renders as a plain DOM element.
  // A Proxy covers every element (div, span, aside, button, …) the page tree
  // uses without enumerating each one.
  const framerOnlyProps = new Set([
    "layoutId",
    "initial",
    "animate",
    "exit",
    "transition",
    "whileInView",
    "whileHover",
    "whileTap",
    "viewport",
    "variants",
    "drag",
    "layout",
  ]);

  const motion = new Proxy(
    {},
    {
      get(_target, tag) {
        return function MotionMock({
          children,
          ...props
        }: { children?: React.ReactNode } & Record<string, unknown>) {
          const domProps: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(props)) {
            if (!framerOnlyProps.has(key)) {
              domProps[key] = value;
            }
          }
          return React.createElement(String(tag), domProps, children);
        };
      },
    },
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion,
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
    expect(container.textContent).toContain("Start on Free");
    expect(container.textContent).toContain("Get Pro");
    expect(container.textContent).toContain("Login");
    expect(container.textContent).not.toContain("Plans & Billing");
    expect(container.textContent).not.toContain("Cancel subscription");
  });
});
