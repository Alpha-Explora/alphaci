/**
 * The root route is the only place the public marketing landing is served, and
 * the gate it uses is edition-only on purpose.
 *
 * PROFILE_PACKS.hosted covers BOTH saas and edu, so a build-profile test would
 * hand EDU the SaaS marketing site, and a bare re-export of the feature barrel
 * would make Enterprise return the excluded-barrel notFound stub instead of the
 * login redirect it had before. Both of those were real defects during the port.
 * This test exists so neither can come back quietly.
 */

const mockRedirect = jest.fn((path: string) => {
  throw new Error("REDIRECT:" + path);
});
jest.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}));

jest.mock("@/features/public-site", () => ({
  __esModule: true,
  default: () => null,
}));

type RootPage = () => unknown;

const COMPOSITION_KEYS = [
  "NEXT_PUBLIC_ALPHACI_EDITION",
  "ALPHACI_EDITION",
  "NEXT_PUBLIC_ALPHACI_BUILD_PROFILE",
  "ALPHACI_BUILD_PROFILE",
] as const;

const originalEnv = { ...process.env };

function loadRootPage(env: Record<string, string>): RootPage {
  jest.resetModules();
  mockRedirect.mockClear();
  for (const key of COMPOSITION_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@/app/page") as { default: RootPage }).default;
}

afterAll(() => {
  process.env = { ...originalEnv };
});

describe("root route edition gate", () => {
  it("serves the marketing landing on the SaaS edition", () => {
    const RootPage = loadRootPage({ NEXT_PUBLIC_ALPHACI_EDITION: "saas" });

    expect(RootPage()).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it.each([
    ["edu", { NEXT_PUBLIC_ALPHACI_EDITION: "edu" }],
    [
      "edu on the hosted profile it shares with saas",
      {
        NEXT_PUBLIC_ALPHACI_EDITION: "edu",
        NEXT_PUBLIC_ALPHACI_BUILD_PROFILE: "hosted",
      },
    ],
    ["enterprise", { NEXT_PUBLIC_ALPHACI_EDITION: "enterprise" }],
    ["an unset edition", {}],
    ["an unrecognised edition", { NEXT_PUBLIC_ALPHACI_EDITION: "marketing" }],
  ])("redirects to /login for %s", (_label, env) => {
    const RootPage = loadRootPage(env);

    expect(() => RootPage()).toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
