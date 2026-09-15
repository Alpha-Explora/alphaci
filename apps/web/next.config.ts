import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  loadCatalogPackage,
  readSurfaceRegistry,
  resolveBuildProfile,
  resolveProfile,
  writeCapabilityStubs,
} = require("./scripts/lib/capability-profile.cjs");

const rootDir = dirname(fileURLToPath(import.meta.url));
const buildProfile = resolveBuildProfile(process.env.ALPHACI_BUILD_PROFILE);
const catalogPackage = loadCatalogPackage();
const profileProjection = resolveProfile(buildProfile, {
  catalog: catalogPackage.catalog,
  manifests: catalogPackage.manifests,
  surfaces: readSurfaceRegistry(),
});
const capabilityAliases = writeCapabilityStubs(
  profileProjection,
  `${rootDir}/.next/capability-stubs`,
);

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
    resolveAlias: capabilityAliases,
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      ...capabilityAliases,
    };
    return config;
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
