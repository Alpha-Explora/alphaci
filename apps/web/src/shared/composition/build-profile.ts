export type BuildProfile = "hosted" | "enterprise";
export type BuildEdition = "saas" | "edu" | "enterprise" | "unknown";

const BUILD_PROFILES = {
  hosted: "hosted",
  enterprise: "enterprise",
} as const satisfies Record<BuildProfile, BuildProfile>;

const BUILD_EDITIONS = {
  saas: "saas",
  edu: "edu",
  enterprise: "enterprise",
  unknown: "unknown",
} as const satisfies Record<BuildEdition, BuildEdition>;

function resolveBuildProfile(value: string | undefined): BuildProfile {
  if (value === undefined || value === "") return BUILD_PROFILES.enterprise;
  if (value === BUILD_PROFILES.hosted || value === BUILD_PROFILES.enterprise) return value;
  throw new Error(`Unknown build profile ${JSON.stringify(value)}`);
}

function resolveBuildEdition(value: string | undefined): BuildEdition {
  if (value === BUILD_EDITIONS.saas) return BUILD_EDITIONS.saas;
  if (value === BUILD_EDITIONS.edu) return BUILD_EDITIONS.edu;
  if (value === BUILD_EDITIONS.enterprise) return BUILD_EDITIONS.enterprise;
  return BUILD_EDITIONS.unknown;
}

/**
 * The profile is injected by next.config.ts for browser code. The backend
 * profile variable remains the source when the Next config itself loads.
 */
export const BUILD_PROFILE = resolveBuildProfile(
  process.env.NEXT_PUBLIC_ALPHACI_BUILD_PROFILE ?? process.env.ALPHACI_BUILD_PROFILE,
);

export const BUILD_EDITION = resolveBuildEdition(
  process.env.NEXT_PUBLIC_ALPHACI_EDITION ?? process.env.ALPHACI_EDITION,
);

export const PUBLIC_SITE_ENABLED = BUILD_EDITION === BUILD_EDITIONS.saas;
