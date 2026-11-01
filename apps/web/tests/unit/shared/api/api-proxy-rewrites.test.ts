import { apiProxyRewrites } from "@/shared/api/api-proxy-rewrites";

/*
 * The FE (Vercel) and BE (Render) sit on different sites, so the session
 * cookie is third-party and browsers that block those drop it: sign-in
 * "did not complete" although the backend had saved the session. Proxying
 * /api/v1 through the FE host makes the cookie first-party.
 */
describe("apiProxyRewrites", () => {
  it.each([undefined, "", "   "])("adds no rewrite when the target is %p", (target) => {
    expect(apiProxyRewrites(target)).toEqual([]);
  });

  it.each([
    "https://alphaci-be.onrender.com",
    "https://alphaci-be.onrender.com/",
    "https://alphaci-be.onrender.com/api/v1",
    " https://alphaci-be.onrender.com/api/v1/ ",
  ])("proxies /api/v1 to the backend origin from %p", (target) => {
    expect(apiProxyRewrites(target)).toEqual([
      {
        source: "/api/v1/:path*",
        destination: "https://alphaci-be.onrender.com/api/v1/:path*",
      },
    ]);
  });

  it("fails the build on a relative target instead of proxying nowhere", () => {
    expect(() => apiProxyRewrites("/api/v1")).toThrow(/absolute backend origin/);
  });

  it("rejects non-http protocols", () => {
    expect(() => apiProxyRewrites("ftp://alphaci-be.onrender.com")).toThrow(/http or https/);
  });
});
