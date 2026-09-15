import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { createGitHubLoginUrl } from "../../../../../../src/features/auth/session";
import { useOAuthLoginViewModel } from "../../../../../../src/features/auth/login/view-models/use-oauth-login-view-model";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "next" ? "/projects/active" : null),
  }),
}));

jest.mock("../../../../../../src/features/auth/session", () => ({
  createGitHubLoginUrl: jest.fn((returnTo: string) => returnTo),
  useAuthSessionViewModel: jest.fn(() => ({
    status: "loading",
    session: null,
  })),
  warmupBackend: jest.fn().mockResolvedValue(undefined),
  getAuthenticatedRedirectPath: jest.fn(),
}));

const mockCreateGitHubLoginUrl = createGitHubLoginUrl as jest.MockedFunction<
  typeof createGitHubLoginUrl
>;

let committedHrefs: string[];

function Probe() {
  const { githubLoginHref } = useOAuthLoginViewModel("login");

  useLayoutEffect(() => {
    committedHrefs.push(githubLoginHref);
  }, [githubLoginHref]);

  return null;
}

describe("useOAuthLoginViewModel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    committedHrefs = [];
    mockCreateGitHubLoginUrl.mockClear();

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

  it("keeps the first callback relative, then preserves the browser-origin OAuth href", async () => {
    const relativeReturnTo =
      "/auth/callback?intent=login&next=%2Fprojects%2Factive&provider=github";

    await act(async () => {
      root.render(<Probe />);
    });

    expect(committedHrefs[0]).toBe(relativeReturnTo);
    expect(mockCreateGitHubLoginUrl.mock.calls[0]?.[0]).toBe(relativeReturnTo);
    expect(committedHrefs.at(-1)).toBe(
      `${window.location.origin}${relativeReturnTo}`,
    );
    expect(mockCreateGitHubLoginUrl.mock.calls.at(-1)?.[0]).toBe(
      `${window.location.origin}${relativeReturnTo}`,
    );
  });
});
