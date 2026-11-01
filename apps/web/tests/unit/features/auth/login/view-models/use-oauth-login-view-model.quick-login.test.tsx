import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { devQuickLogin } from "../../../../../../src/features/auth/session";
import {
  useOAuthLoginViewModel,
  type OAuthLoginViewModel,
} from "../../../../../../src/features/auth/login/view-models/use-oauth-login-view-model";

const mockRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock("../../../../../../src/features/auth/session", () => ({
  authErrorStatus: jest.fn(() => null),
  createGitHubLoginUrl: jest.fn((returnTo: string) => returnTo),
  devQuickLogin: jest.fn().mockResolvedValue({ ok: true }),
  useAuthSessionViewModel: jest.fn(() => ({
    status: "signed-out",
    session: null,
    refresh: mockRefresh,
  })),
  warmupBackend: jest.fn().mockResolvedValue(undefined),
  getAuthenticatedRedirectPath: jest.fn(),
}));

jest.mock("../../../../../../src/shared/api/request", () => ({
  getApiBaseUrl: jest.fn(() => "http://localhost:4000/api/v1"),
}));

const mockDevQuickLogin = devQuickLogin as jest.MockedFunction<
  typeof devQuickLogin
>;

let currentViewModel: OAuthLoginViewModel | null = null;

function Probe() {
  const viewModel = useOAuthLoginViewModel("login");
  useLayoutEffect(() => {
    currentViewModel = viewModel;
  }, [viewModel]);
  return null;
}

describe("useOAuthLoginViewModel Quick login", () => {
  let originalNodeEnv: string | undefined;
  let originalFlag: string | undefined;
  let originalApiBaseUrl: string | undefined;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    originalFlag = process.env.NEXT_PUBLIC_DEV_QUICK_LOGIN;
    originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_DEV_QUICK_LOGIN = "true";
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000/api/v1";
    currentViewModel = null;
    mockDevQuickLogin.mockReset();
    mockDevQuickLogin.mockResolvedValue({ ok: true });
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Probe />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_DEV_QUICK_LOGIN;
    else process.env.NEXT_PUBLIC_DEV_QUICK_LOGIN = originalFlag;
    if (originalApiBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  });

  it("creates the backend session and refreshes the normal auth session", async () => {
    expect(currentViewModel?.canQuickLogin).toBe(true);

    await act(async () => {
      await currentViewModel?.handleQuickLogin();
    });

    expect(mockDevQuickLogin).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(currentViewModel?.quickLoginError).toBeNull();
  });

  it("does not expose or call Quick login in a production runtime", async () => {
    process.env.NODE_ENV = "production";

    await act(async () => {
      root.render(<Probe />);
    });

    expect(currentViewModel?.canQuickLogin).toBe(false);

    await act(async () => {
      await currentViewModel?.handleQuickLogin();
    });

    expect(mockDevQuickLogin).not.toHaveBeenCalled();
  });
});
