import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  loadCatalogPackage,
  packageDriftErrors,
} = require("../../../../../scripts/lib/capability-profile.cjs") as {
  loadCatalogPackage: (packageDirectory?: string) => {
    metadata: { name: string; version: string };
    provenance: Record<string, unknown>;
    catalog: unknown[];
    manifests: Record<string, unknown>;
    surfaces: unknown[];
  };
  packageDriftErrors: (
    snapshot: Array<Record<string, unknown>>,
    packageValue: {
      metadata: { name: string; version: string };
      provenance: Record<string, unknown>;
      catalog: unknown[];
      manifests: Record<string, unknown>;
      surfaces: unknown[];
    },
    packageDirectory?: string,
  ) => string[];
};
/* eslint-enable @typescript-eslint/no-require-imports */

const root = path.resolve(__dirname, "../../../../../");
const vendorDirectory = path.join(root, "vendor", "@alphaci", "capability-catalog");
const snapshot = JSON.parse(
  readFileSync(path.join(root, "docs/capabilities/catalog.snapshot.json"), "utf8"),
) as Array<Record<string, unknown>>;

function withVendorCopy(run: (packageDirectory: string) => void): void {
  const packageDirectory = mkdtempSync(path.join(os.tmpdir(), "alphaci-capability-vendor-"));
  cpSync(vendorDirectory, packageDirectory, { recursive: true });
  try {
    run(packageDirectory);
  } finally {
    rmSync(packageDirectory, { recursive: true, force: true });
  }
}

describe("frontend capability package provenance", () => {
  it("accepts the clean vendored release artifact", () => {
    withVendorCopy((packageDirectory) => {
      expect(
        packageDriftErrors(snapshot, loadCatalogPackage(packageDirectory), packageDirectory),
      ).toEqual([]);
    });
  });

  it("rejects a vendor edit to a canonical package file", () => {
    withVendorCopy((packageDirectory) => {
      appendFileSync(path.join(packageDirectory, "index.js"), "\n// tampered\n", "utf8");

      expect(
        packageDriftErrors(snapshot, loadCatalogPackage(packageDirectory), packageDirectory).join(" "),
      ).toMatch(/artifact digest does not match provenance/);
    });
  });

  it("rejects a vendor edit to the provenance record", () => {
    withVendorCopy((packageDirectory) => {
      const provenancePath = path.join(packageDirectory, "provenance.json");
      const provenance = JSON.parse(readFileSync(provenancePath, "utf8")) as {
        sourceRepository: string;
      };
      provenance.sourceRepository = "github.com/example/tampered";
      writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

      expect(
        packageDriftErrors(snapshot, loadCatalogPackage(packageDirectory), packageDirectory).join(" "),
      ).toMatch(/sourceRepository must be|does not match docs\/capabilities\/catalog\.provenance\.json/);
    });
  });
});
