import {
  canUseDevQuickLogin,
  isLoopbackHttpOrigin,
} from "../../../../../../src/features/auth/login/model/dev-quick-login";

const enabledLocal = {
  nodeEnv: "development",
  featureFlag: "true",
  browserOrigin: "http://localhost:3000",
  apiBaseUrl: "http://localhost:4000/api/v1",
  apiBaseUrlConfigured: true,
};

describe("canUseDevQuickLogin", () => {
  it("allows an explicitly enabled loopback development setup", () => {
    expect(canUseDevQuickLogin(enabledLocal)).toBe(true);
  });

  it.each([
    ["production", { nodeEnv: "production" }],
    ["the missing flag", { featureFlag: undefined }],
    ["a missing API configuration", { apiBaseUrlConfigured: false }],
    ["a remote browser", { browserOrigin: "https://app.example.com" }],
    ["a remote API", { apiBaseUrl: "https://api.example.com/api/v1" }],
  ])("rejects %s", (_reason, override) => {
    expect(canUseDevQuickLogin({ ...enabledLocal, ...override })).toBe(false);
  });
});

describe("isLoopbackHttpOrigin", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("accepts %s", (origin) => {
    expect(isLoopbackHttpOrigin(origin)).toBe(true);
  });

  it.each([
    "https://localhost:3000",
    "http://localhost/app",
    "http://localhost?next=https://evil.example.com",
    "http://localhost.evil.example:3000",
    "//localhost:3000",
  ])("rejects %s", (origin) => {
    expect(isLoopbackHttpOrigin(origin)).toBe(false);
  });
});
