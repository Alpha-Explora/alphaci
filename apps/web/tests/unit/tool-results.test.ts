import type { JobLogSection } from "../../src/features/runs/model/job-log-sections";
import {
  summarizeJobLog,
  toolResultForSection,
} from "../../src/features/runs/model/tool-results";

/**
 * Each case is the line the tool itself writes, as it writes it. A number we
 * read wrongly is worse than no number — it sends someone to the wrong place —
 * so every extractor is pinned to real output here.
 */
function section(
  title: string,
  output: string,
  failed = false,
): JobLogSection {
  return {
    title,
    command: title.startsWith("Run ") ? title.slice(4) : null,
    lines: output.split("\n").map((text) => ({ text, severity: "plain" })),
    failed,
    durationSeconds: null,
  };
}

const read = (title: string, output: string, failed = false) =>
  toolResultForSection(section(title, output, failed));

describe("toolResultForSection — the quality stage", () => {
  it("counts ESLint's errors and warnings apart", () => {
    const result = read(
      "Run npm run lint",
      "✖ 15 problems (3 errors, 12 warnings)",
      true,
    );

    expect(result.tool).toBe("eslint");
    expect(result.outcome).toBe("failed");
    expect(result.summary).toBe("3 errors, 12 warnings");
  });

  it("reads a Jest run with its coverage", () => {
    const result = read(
      "Run npm test",
      [
        "Tests:       2 failed, 40 passed, 42 total",
        "All files    |   87.53 |    81.2 |",
      ].join("\n"),
      true,
    );

    expect(result.tool).toBe("jest");
    expect(result.summary).toBe("2 tests failed of 42, coverage 87.53%");
  });

  it("reads a clean Jest run", () => {
    const result = read("Run npm test", "Tests:       40 passed, 40 total");

    expect(result.summary).toBe("40 tests passed");
  });

  it("reads dotnet test, with ReportGenerator's coverage wording", () => {
    const result = read(
      "Run dotnet test --no-build",
      [
        "Failed!  - Failed:     2, Passed:     5, Skipped:     0, Total:     7, Duration: 186 ms",
        "Line coverage: 78.4%",
      ].join("\n"),
      true,
    );

    expect(result.tool).toBe("dotnet-test");
    expect(result.summary).toBe("2 tests failed of 7, coverage 78.4%");
  });

  it("counts type errors, however tsc phrases it", () => {
    expect(read("Run npm run typecheck", "Found 3 errors.", true).summary).toBe(
      "3 type errors",
    );
    expect(
      read(
        "Run tsc --noEmit",
        "src/a.ts(3,1): error TS2345: Argument of type…",
        true,
      ).summary,
    ).toBe("1 type error");
  });

  it("counts the files dotnet format would rewrite", () => {
    const result = read(
      "Run dotnet format --verify-no-changes",
      ["Formatted code file 'Program.cs'", "Formatted code file 'Api.cs'"].join(
        "\n",
      ),
      true,
    );

    expect(result.tool).toBe("dotnet-format");
    expect(result.summary).toBe("2 files need formatting");
  });
});

describe("toolResultForSection — security and the gates", () => {
  it("names the Sonar condition that failed the gate", () => {
    const result = read(
      "Run sonarsource/sonarqube-scan-action",
      [
        "QUALITY GATE STATUS: FAILED",
        "- Coverage on New Code is less than 90%",
      ].join("\n"),
      true,
    );

    expect(result.summary).toBe(
      "quality gate failed on Coverage on New Code",
    );
  });

  it("reads a passing Sonar gate", () => {
    expect(
      read("Run sonar-scanner", "QUALITY GATE STATUS: PASSED").summary,
    ).toBe("quality gate passed");
  });

  it("reads npm audit both ways", () => {
    expect(read("Run npm audit", "found 0 vulnerabilities").summary).toBe(
      "no advisories",
    );
    expect(
      read("Run npm audit", "3 vulnerabilities (1 moderate, 2 high)", true)
        .summary,
    ).toBe("3 advisories (1 moderate, 2 high)");
  });

  it("reads Trivy's totals", () => {
    expect(
      read("Run trivy image", "Total: 12 (HIGH: 3, CRITICAL: 1)", true).summary,
    ).toBe("12 findings (HIGH: 3, CRITICAL: 1)");
    expect(read("Run trivy image", "Total: 0 (HIGH: 0)").summary).toBe(
      "no findings",
    );
  });

  it("reads the secret scan", () => {
    expect(read("Run gitleaks detect", "no leaks found").summary).toBe(
      "no secrets found",
    );
    expect(
      read("Run gitleaks detect", "leaks found: 2", true).summary,
    ).toBe("2 secrets found");
  });

  it("counts disallowed licences", () => {
    const result = read(
      "Run licence scan",
      "disallowed licence: GPL-3.0",
      true,
    );

    expect(result.tool).toBe("licenses");
    expect(result.summary).toBe("1 disallowed licence");
  });

  it("reads the SBOM's inventory", () => {
    expect(read("Run syft packages", "402 packages").summary).toBe(
      "402 packages inventoried",
    );
  });
});

describe("toolResultForSection — build, deploy and verify", () => {
  it("names the image that was built", () => {
    expect(
      read("Run docker/build-push-action", "naming to ghcr.io/org/api:sha-abc")
        .summary,
    ).toBe("built ghcr.io/org/api:sha-abc");
  });

  it("names a pushed image when the build only reports the push", () => {
    expect(
      read("Run docker push", "pushed ghcr.io/org/api:sha-def in 4s").summary,
    ).toBe("pushed ghcr.io/org/api:sha-def");
  });

  it("names the address a deploy landed on", () => {
    expect(
      read("Run vercel deploy --prebuilt", "https://uat-demo-fe.vercel.app")
        .summary,
    ).toBe("deployed to https://uat-demo-fe.vercel.app");
    expect(
      read("Run release", "https://demo-backend-uat.onrender.com").summary,
    ).toBe("released to https://demo-backend-uat.onrender.com");
  });

  it("reads Bruno's requests and assertions", () => {
    expect(
      read(
        "Run bru run",
        ["Requests:   4 passed, 0 failed", "Assertions: 12 passed, 0 failed"].join(
          "\n",
        ),
      ).summary,
    ).toBe("4 requests, 12 assertions passed");
  });

  it("reports a Bruno failure as failures, not as a count of passes", () => {
    expect(
      read(
        "Run bru run",
        ["Requests:   3 passed, 1 failed", "Assertions: 9 passed, 2 failed"].join(
          "\n",
        ),
        true,
      ).summary,
    ).toBe("3 checks failed");
  });

  it("reads Playwright's tally", () => {
    expect(
      read("Run npm run test:e2e", "1 failed\n3 passed (12.4s)", true).summary,
    ).toBe("1 failed, 3 passed");
  });
});

describe("toolResultForSection — what it refuses to guess", () => {
  it("falls back to the step's own name and its error count", () => {
    const result = read(
      "Run ./scripts/something-bespoke.sh",
      "boom",
      true,
    );

    expect(result.tool).toBe("step");
    expect(result.label).toBe("Run ./scripts/something-bespoke.sh");
  });

  it.each([
    ["Run npm audit", "audit output we cannot read"],
    ["Run trivy image", "scanning…"],
    ["Run docker build", "step 1/8"],
    ["Run bru run", "collection started"],
    ["Run syft packages", "cataloging"],
  ])("reads no number out of %s when there is none", (title, output) => {
    expect(read(title, output).summary).toBeNull();
  });

  it("says nothing rather than something wrong when the format is unknown", () => {
    // A tool we recognise that printed something we do not.
    const result = read("Run npm run lint", "eslint exited oddly", true);

    expect(result.tool).toBe("eslint");
    expect(result.summary).toBeNull();
    expect(result.outcome).toBe("failed");
  });

  it("counts marked error lines for an unknown tool", () => {
    const bespoke: JobLogSection = {
      title: "Run ./deploy.sh",
      command: "./deploy.sh",
      lines: [
        { text: "starting", severity: "plain" },
        { text: "could not reach the host", severity: "error" },
        { text: "giving up", severity: "error" },
      ],
      failed: true,
      durationSeconds: null,
    };

    expect(toolResultForSection(bespoke).summary).toBe("2 error lines");
  });
});

describe("summarizeJobLog", () => {
  it("drops the runner's own steps, which never vary", () => {
    const rows = summarizeJobLog([
      section("Job start", "Runner name: gh-runner-3"),
      section("Set up job", "Operating System"),
      section("Checkout", "Syncing repository"),
      section("Run npm run lint", "✖ 1 problems (1 error, 0 warnings)", true),
      section("Post Checkout", "cleanup"),
    ]);

    expect(rows.map((row) => row.tool)).toEqual(["eslint"]);
  });

  it("keeps a set-up step that actually failed", () => {
    // When checkout is what broke, hiding it is how a run becomes a mystery.
    const rows = summarizeJobLog([
      section("Checkout", "fatal: reference is not a tree", true),
      section("Run npm test", "Tests:       1 passed, 1 total"),
    ]);

    expect(rows.map((row) => row.label)).toEqual([
      "Checkout",
      "Unit tests (Jest)",
    ]);
  });
});
