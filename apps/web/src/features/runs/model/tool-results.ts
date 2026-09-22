/**
 * What each tool in a job actually said, in one line per tool.
 *
 * A step tells you `Run npm run lint` failed. The number that makes it
 * actionable — three errors, or coverage at 78% against a 90% gate — is in the
 * step's output, in a format only that tool writes. This reads it out.
 *
 * Table-driven on purpose: a tool is an id, a label, how to recognise it and
 * how to read its result. Adding one is an entry, not a branch in a function,
 * and a tool nobody taught us still gets the generic count below.
 *
 * Every extractor is deliberately narrow. A number we are not sure of is worse
 * than no number, because a wrong count sends someone looking in the wrong
 * place — so an unrecognised format returns null and the row falls back to the
 * outcome alone.
 *
 * Pure: no React, no fetch.
 */

import type { JobLogSection } from "./job-log-sections";

export type ToolOutcome = "passed" | "failed" | "unknown";

export interface ToolResult {
  /** Stable id, for keys and tests. */
  tool: string;
  /** How the tool is named in the product's vocabulary. */
  label: string;
  outcome: ToolOutcome;
  /** The actionable part: "3 errors, 12 warnings". Null when unreadable. */
  summary: string | null;
}

interface ToolReader {
  tool: string;
  label: string;
  /** Recognises the step that runs this tool. */
  matches: RegExp;
  /** Reads the tool's own result line out of its output. */
  read: (text: string) => string | null;
}

/** `many` is given where adding an s is wrong: advisory → advisories. */
const plural = (count: number, noun: string, many = `${noun}s`) =>
  `${String(count)} ${count === 1 ? noun : many}`;

/** Coverage is reported by the test step, in whichever tool's dialect. */
function coverageClause(text: string): string | null {
  const istanbul = /All files\s*\|\s*([\d.]+)/.exec(text);
  if (istanbul) return `coverage ${istanbul[1]}%`;
  const reportGenerator = /Line coverage:\s*([\d.]+)%/.exec(text);
  if (reportGenerator) return `coverage ${reportGenerator[1]}%`;
  return null;
}

function withCoverage(base: string, text: string): string {
  const coverage = coverageClause(text);
  return coverage ? `${base}, ${coverage}` : base;
}

const READERS: ToolReader[] = [
  {
    tool: "eslint",
    label: "Format & style (ESLint)",
    matches: /eslint|run lint\b/i,
    read: (text) => {
      const problems =
        /\d+ problems? \((\d+) errors?, (\d+) warnings?\)/.exec(text);
      if (problems) {
        return `${plural(Number(problems[1]), "error")}, ${plural(Number(problems[2]), "warning")}`;
      }
      return null;
    },
  },
  {
    tool: "dotnet-format",
    label: "Format & style (dotnet format)",
    matches: /dotnet format/i,
    read: (text) => {
      const files = text.match(/Formatted code file/g);
      return files ? `${plural(files.length, "file")} need formatting` : null;
    },
  },
  {
    tool: "jest",
    label: "Unit tests (Jest)",
    // `(?!:)` keeps `npm run test:e2e` for Playwright: a matcher that claims a
    // step it cannot read leaves the row with no numbers at all.
    matches: /jest|(?:npm |run )test\b(?!:)/i,
    read: (text) => {
      const tests =
        /Tests:\s+(?:(\d+) failed,\s+)?(?:(\d+) skipped,\s+)?(?:(\d+) passed,\s+)?(\d+) total/.exec(
          text,
        );
      if (!tests) return null;
      const failed = Number(tests[1] ?? 0);
      const total = Number(tests[4]);
      const base =
        failed > 0
          ? `${plural(failed, "test")} failed of ${String(total)}`
          : `${plural(total, "test")} passed`;
      return withCoverage(base, text);
    },
  },
  {
    tool: "dotnet-test",
    label: "Unit tests (dotnet test)",
    matches: /dotnet test/i,
    read: (text) => {
      const result =
        /(?:Passed|Failed)!\s+-\s+Failed:\s+(\d+),\s+Passed:\s+(\d+),\s+Skipped:\s+(\d+),\s+Total:\s+(\d+)/.exec(
          text,
        );
      if (!result) return null;
      const failed = Number(result[1]);
      const total = Number(result[4]);
      const base =
        failed > 0
          ? `${plural(failed, "test")} failed of ${String(total)}`
          : `${plural(total, "test")} passed`;
      return withCoverage(base, text);
    },
  },
  {
    tool: "typecheck",
    label: "Types (tsc)",
    matches: /tsc\b|typecheck/i,
    read: (text) => {
      const found = /Found (\d+) errors?/.exec(text);
      if (found) return `${plural(Number(found[1]), "type error")}`;
      const errors = text.match(/error TS\d+/g);
      return errors ? plural(errors.length, "type error") : null;
    },
  },
  {
    tool: "sonar",
    label: "Code quality (Sonar)",
    matches: /sonar/i,
    read: (text) => {
      const gate = /QUALITY GATE STATUS:\s*(PASSED|FAILED)/i.exec(text);
      if (!gate) return null;
      const failedCondition = /- (.+?) is (?:greater|less) than/.exec(text);
      const status = `quality gate ${gate[1].toLowerCase()}`;
      return failedCondition ? `${status} on ${failedCondition[1]}` : status;
    },
  },
  {
    tool: "audit",
    label: "Dependency audit",
    matches: /npm audit|dependency (audit|review)/i,
    read: (text) => {
      if (/found 0 vulnerabilities/.test(text)) return "no advisories";
      const found = /(\d+) vulnerabilities?\s*\(([^)]*)\)/.exec(text);
      if (found) {
        return `${plural(Number(found[1]), "advisory", "advisories")} (${found[2]})`;
      }
      return null;
    },
  },
  {
    tool: "trivy",
    label: "Image scan (Trivy)",
    matches: /trivy/i,
    read: (text) => {
      const total = /Total:\s*(\d+)\s*\(([^)]*)\)/.exec(text);
      if (!total) return null;
      const count = Number(total[1]);
      return count === 0
        ? "no findings"
        : `${plural(count, "finding")} (${total[2]})`;
    },
  },
  {
    tool: "secrets",
    label: "Secret scan",
    matches: /gitleaks|secret scan|trufflehog/i,
    read: (text) => {
      if (/no leaks found/i.test(text)) return "no secrets found";
      const leaks = /leaks found:\s*(\d+)/i.exec(text);
      return leaks ? `${plural(Number(leaks[1]), "secret")} found` : null;
    },
  },
  {
    tool: "licenses",
    label: "Licence scan",
    matches: /licen[cs]e/i,
    read: (text) => {
      const disallowed = text.match(/disallowed licen[cs]e/gi);
      return disallowed
        ? `${plural(disallowed.length, "disallowed licence")}`
        : null;
    },
  },
  {
    tool: "sbom",
    label: "SBOM export",
    matches: /sbom|syft|cyclonedx/i,
    read: (text) => {
      const packages = /\b(\d+) packages?\b/.exec(text);
      return packages
        ? `${plural(Number(packages[1]), "package")} inventoried`
        : null;
    },
  },
  {
    tool: "docker",
    label: "Image build",
    matches: /docker|buildx/i,
    read: (text) => {
      const naming = /naming to (\S+)/.exec(text);
      if (naming) return `built ${naming[1]}`;
      const pushed = /pushed\s+(\S+:\S+)/.exec(text);
      return pushed ? `pushed ${pushed[1]}` : null;
    },
  },
  {
    tool: "vercel",
    label: "Vercel deploy",
    matches: /vercel/i,
    read: (text) => {
      const alias = /https:\/\/[\w.-]+\.vercel\.app/.exec(text);
      return alias ? `deployed to ${alias[0]}` : null;
    },
  },
  {
    tool: "render",
    label: "Render release",
    matches: /render|release/i,
    read: (text) => {
      const url = /https:\/\/[\w.-]+\.onrender\.com/.exec(text);
      return url ? `released to ${url[0]}` : null;
    },
  },
  {
    tool: "bruno",
    label: "API tests (Bruno)",
    matches: /\bbru\b|bruno/i,
    read: (text) => {
      const requests = /Requests:\s+(\d+) passed,\s+(\d+) failed/.exec(text);
      const asserts = /Assertions:\s+(\d+) passed,\s+(\d+) failed/.exec(text);
      if (!requests) return null;
      const failed = Number(requests[2]) + Number(asserts?.[2] ?? 0);
      return failed > 0
        ? `${plural(failed, "check")} failed`
        : `${plural(Number(requests[1]), "request")}, ${asserts ? plural(Number(asserts[1]), "assertion") : "no assertions"} passed`;
    },
  },
  {
    tool: "playwright",
    label: "Browser tests (Playwright)",
    matches: /playwright|test:e2e/i,
    read: (text) => {
      const failed = /(\d+) failed/.exec(text);
      const passed = /(\d+) passed/.exec(text);
      if (!failed && !passed) return null;
      const parts: string[] = [];
      if (failed) parts.push(`${failed[1]} failed`);
      if (passed) parts.push(`${passed[1]} passed`);
      return parts.join(", ");
    },
  },
];

function sectionText(section: JobLogSection): string {
  return section.lines.map((line) => line.text).join("\n");
}

/** The step's own name, when no known tool claims it. */
function generic(section: JobLogSection): ToolResult {
  const errors = section.lines.filter(
    (line) => line.severity === "error",
  ).length;

  return {
    tool: "step",
    label: section.title,
    outcome: section.failed ? "failed" : "passed",
    summary: errors > 0 ? `${plural(errors, "error line")}` : null,
  };
}

/**
 * What one step's tool concluded.
 *
 * Matched on the command the step ran rather than on its output, so a step
 * that failed before producing any is still attributed to the right tool.
 */
export function toolResultForSection(section: JobLogSection): ToolResult {
  const haystack = `${section.title} ${section.command ?? ""}`;
  const reader = READERS.find((candidate) => candidate.matches.test(haystack));
  if (!reader) return generic(section);

  return {
    tool: reader.tool,
    label: reader.label,
    outcome: section.failed ? "failed" : "passed",
    summary: reader.read(sectionText(section)),
  };
}

/**
 * One line per step that ran a tool.
 *
 * The runner's own set-up steps are dropped: nobody debugging a pipeline needs
 * "Checkout" and "Set up job" restated, and leaving them in buries the four
 * rows that carry the answer among a dozen that never vary.
 */
const RUNNER_NOISE =
  /^(Job start|Set up job|Checkout|Post |Complete job|Set up runner|Runner Image)/i;

export function summarizeJobLog(sections: JobLogSection[]): ToolResult[] {
  return sections
    .filter((section) => section.failed || !RUNNER_NOISE.test(section.title))
    .map(toolResultForSection);
}
