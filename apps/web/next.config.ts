import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { apiProxyRewrites } from "./src/shared/api/api-proxy-rewrites";
import { BUILD_EDITION, BUILD_PROFILE } from "./src/shared/composition/build-profile";

const require = createRequire(import.meta.url);
const {
  loadCatalogPackage,
  readSurfaceRegistry,
  resolveBuildProfile,
  resolveProfile,
  writeCapabilityStubs,
} = require("./scripts/lib/capability-profile.cjs");

const rootDir = dirname(fileURLToPath(import.meta.url));
const buildProfile = resolveBuildProfile(BUILD_PROFILE);
const catalogPackage = loadCatalogPackage();
const profileProjection = resolveProfile(buildProfile, {
  catalog: catalogPackage.catalog,
  manifests: catalogPackage.manifests,
  surfaces: readSurfaceRegistry(),
});
// Stubs are generated modules the bundler must compile, so they have to sit
// where it treats them as first-party source: Turbopack neither resolves
// anything out of .next nor transforms files inside node_modules.
const capabilityAliases = writeCapabilityStubs(
  profileProjection,
  `${rootDir}/.capability-stubs`,
);
// Turbopack rejects absolute Windows paths ("windows imports are not
// implemented yet"), so it gets project-relative aliases; webpack keeps the
// absolute ones.
const turbopackCapabilityAliases = Object.fromEntries(
  Object.entries(capabilityAliases as Record<string, string>).map(
    ([barrel, file]) => [barrel, `./${relative(rootDir, file).split(sep).join("/")}`],
  ),
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ALPHACI_BUILD_PROFILE: buildProfile,
    NEXT_PUBLIC_ALPHACI_EDITION: BUILD_EDITION,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  turbopack: {
    root: rootDir,
    resolveAlias: turbopackCapabilityAliases,
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      ...capabilityAliases,
    };
    return config;
  },
  // Rewrites compile into the build output, so API_PROXY_TARGET must be set at
  // build time, the same as NEXT_PUBLIC_* values.
  async rewrites() {
    return apiProxyRewrites(process.env.API_PROXY_TARGET);
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
