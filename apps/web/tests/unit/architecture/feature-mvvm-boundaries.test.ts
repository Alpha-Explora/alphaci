import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");
const srcRoot = join(repoRoot, "src");

describe("feature MVVM architecture", () => {
  it("passes the repository boundary checker", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [join(repoRoot, "scripts/check-boundaries.mjs"), "--cwd", repoRoot, "--src", "src"],
        { cwd: repoRoot, stdio: "pipe" },
      ),
    ).not.toThrow();
  });

  it("keeps the App Router grouped and free of legacy source roots", () => {
    const appRoot = join(srcRoot, "app");
    expect(readdirSync(appRoot)).toEqual(
      expect.arrayContaining(["(access)", "(platform)", "(public)"]),
    );

    for (const legacyRoot of ["components", "hooks"]) {
      const files = existsSync(join(srcRoot, legacyRoot))
        ? readdirSync(join(srcRoot, legacyRoot), { recursive: true })
        : [];
      expect(files.filter((file) => /\.(ts|tsx|js|jsx)$/.test(String(file)))).toEqual([]);
    }

    expect(readFileSync(join(srcRoot, "app/(platform)/home/page.tsx"), "utf8")).toContain(
      "@/features/home/dashboard",
    );
    expect(readFileSync(join(srcRoot, "app/(public)/guide/page.tsx"), "utf8")).toContain(
      "@/features/guide/overview",
    );
  });
});
