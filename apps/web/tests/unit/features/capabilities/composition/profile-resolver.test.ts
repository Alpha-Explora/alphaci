import fs from "node:fs";
import path from "node:path";

// The profile resolver is a CommonJS build helper; load it without making the
// test module itself depend on a runtime TypeScript import boundary.
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  PROFILE_PACKS,
  loadCatalogPackage,
  packageDriftErrors,
  readSurfaceRegistry,
  resolveBuildProfile,
  resolveProfile,
  stubSource,
} = require("../../../../../scripts/lib/capability-profile.cjs");
/* eslint-enable @typescript-eslint/no-require-imports */

const root = path.resolve(__dirname, "../../../../../");
const catalogPackage = loadCatalogPackage();
const surfaces = readSurfaceRegistry();

function project(profile: "hosted" | "enterprise") {
  return resolveProfile(profile, {
    catalog: catalogPackage.catalog,
    manifests: catalogPackage.manifests,
    surfaces,
  });
}

describe("frontend build profile resolver", () => {
  it("projects hosted as saas plus edu deterministically", () => {
    const first = project("hosted");
    const second = project("hosted");

    expect(first).toEqual(second);
    expect(first.packs).toEqual(["saas", "edu"]);
    expect(first.excludedCapabilityKeys).toEqual([
      "identity.sso-scim",
      "platform.data-residency",
      "runtime.managed-secrets",
      "runtime.air-gap-packaging",
      "runtime.customer-isolation",
      "pipelines.github-enterprise-server",
    ]);
    expect(first.excludedFeatureBarrels).toEqual([]);
  });

  it("projects enterprise deterministically and keeps current surfaces included", () => {
    const projection = project("enterprise");

    expect(projection.packs).toEqual(["enterprise"]);
    expect(projection.excludedCapabilityKeys).toEqual([
      "identity.lms-lti",
      "identity.cohort-policy",
      "identity.edu-provisioning",
      "identity.ferpa-workflows",
      "billing.checkout",
    ]);
    expect(projection.includedFeatureBarrels).toContain("@/features/projects");
    expect(projection.excludedFeatureBarrels).toEqual([]);
  });

  it("fails clearly for an unknown profile", () => {
    expect(() => resolveBuildProfile("unknown")).toThrow("Unknown ALPHACI_BUILD_PROFILE");
    expect(() => resolveProfile("unknown", {
      catalog: catalogPackage.catalog,
      manifests: catalogPackage.manifests,
      surfaces,
    })).toThrow("Unknown build profile");
  });

  it("detects package drift against the snapshot", () => {
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(root, "docs/capabilities/catalog.snapshot.json"), "utf8"),
    );
    expect(packageDriftErrors(snapshot, catalogPackage)).toEqual([]);
    expect(packageDriftErrors(snapshot, {
      ...catalogPackage,
      catalog: catalogPackage.catalog.slice(1),
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("does not match docs/capabilities/catalog.snapshot.json"),
    ]));
  });

  it("generates a notFound stub for any future excluded barrel", () => {
    expect(stubSource("@/features/future-exclusive")).toContain("return notFound();");
  });

  it("keeps profile membership data-driven", () => {
    expect(PROFILE_PACKS).toEqual({ hosted: ["saas", "edu"], enterprise: ["enterprise"] });
  });

  it("rejects a dependency that crosses the selected profile ceiling", () => {
    const manifests = {
      ...catalogPackage.manifests,
      saas: ["billing.checkout"],
    };
    const catalog = catalogPackage.catalog.map((record) =>
      record.key === "billing.checkout"
        ? { ...record, requires: ["runtime.managed-secrets"] }
        : record,
    );

    expect(() => resolveProfile("hosted", { catalog, manifests, surfaces })).toThrow(
      "dependency closure exceeds its pack ceiling",
    );
  });

  it("does not exclude a barrel still needed by an included capability", () => {
    const sharedBarrel = "@/features/shared-surface";
    const projection = resolveProfile("hosted", {
      catalog: catalogPackage.catalog,
      manifests: catalogPackage.manifests,
      surfaces: [
        { key: "runtime.env-provisioning", featureBarrels: [sharedBarrel] },
        { key: "runtime.managed-secrets", featureBarrels: [sharedBarrel] },
      ],
    });

    expect(projection.includedFeatureBarrels).toEqual([sharedBarrel]);
    expect(projection.excludedFeatureBarrels).toEqual([]);
  });
});
