import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  turbopack: {
    root: rootDir,
  },
  async headers() {
    return [
      {
        // The page shell (nav, brand wordmark, layout) is statically
        // prerendered into HTML at build time. Without this, the browser's
        // disk cache / bfcache can serve a stale shell after a redeploy — e.g.
        // showing the old "FlowCI" brand on first paint until a later
        // navigation revalidates. `no-store` forces every document load to
        // fetch the current build and also opts the page out of bfcache, so a
        // rebrand/redeploy is reflected immediately.
        //
        // The negative lookahead excludes Next.js build output (/_next/*):
        // those assets are content-hashed and MUST stay immutably cached.
        source: "/:path((?!_next/).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
