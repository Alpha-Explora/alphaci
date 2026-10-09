/* SonarCloud in words — metric names, units, ratings and failed conditions.
 * Pure. The wording matches the backend's CI results Markdown, so the page and
 * the export say the same thing. */

import type { StageResults } from "@/shared/api/contracts";

export type SonarResult = NonNullable<StageResults["sonar"]>;

const METRIC_NAMES: Record<string, string> = {
  bugs: "Bugs",
  vulnerabilities: "Vulnerabilities",
  code_smells: "Code smells",
  security_hotspots: "Security hotspots",
  coverage: "Coverage",
  duplicated_lines_density: "Duplicated lines",
  new_bugs: "New bugs",
  new_vulnerabilities: "New vulnerabilities",
  new_code_smells: "New code smells",
  new_security_hotspots: "New security hotspots",
  new_coverage: "Coverage on new code",
  new_duplicated_lines_density: "Duplicated lines on new code",
  new_reliability_rating: "Reliability rating on new code",
  new_security_rating: "Security rating on new code",
  new_maintainability_rating: "Maintainability rating on new code",
  new_security_hotspots_reviewed: "Security hotspots reviewed on new code",
  reliability_rating: "Reliability rating",
  security_rating: "Security rating",
  sqale_rating: "Maintainability rating",
};

const PERCENT = new Set([
  "coverage",
  "duplicated_lines_density",
  "new_coverage",
  "new_duplicated_lines_density",
  "new_security_hotspots_reviewed",
]);

const RATINGS = ["A", "B", "C", "D", "E"];

/** The order measures are shown in; anything else follows, as SonarCloud named it. */
const MEASURE_ORDER = [
  "bugs",
  "vulnerabilities",
  "code_smells",
  "security_hotspots",
  "coverage",
  "new_coverage",
  "duplicated_lines_density",
  "new_duplicated_lines_density",
];

export function sonarMetricName(metric: string): string {
  return METRIC_NAMES[metric] ?? metric;
}

export function sonarValue(metric: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") return "—";
  if (metric.endsWith("_rating")) return RATINGS[Math.round(Number(value)) - 1] ?? value;
  return PERCENT.has(metric) ? `${value}%` : value;
}

/** "Coverage on new code 61.2% (needs 80%)". */
export function sonarCondition(condition: NonNullable<SonarResult["failedConditions"]>[number]): string {
  const actual = condition.actual !== undefined ? ` ${sonarValue(condition.metric, condition.actual)}` : "";
  const needs = condition.threshold !== undefined ? ` (needs ${sonarValue(condition.metric, condition.threshold)})` : "";
  return `${sonarMetricName(condition.metric)}${actual}${needs}`;
}

export interface SonarMeasure {
  metric: string;
  label: string;
  value: string;
}

export function sonarMeasures(measures: SonarResult["measures"]): SonarMeasure[] {
  const entries = Object.entries(measures ?? {});
  const rank = (metric: string) => {
    const index = MEASURE_ORDER.indexOf(metric);
    return index === -1 ? MEASURE_ORDER.length : index;
  };
  return entries
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([metric, value]) => ({ metric, label: sonarMetricName(metric), value: sonarValue(metric, value) }));
}

export type SonarGateTone = "success" | "danger" | "warning" | "muted";

export interface SonarGate {
  label: string;
  tone: SonarGateTone;
}

const BLOCKED_REASONS: Record<string, string> = {
  "automatic-analysis":
    "SonarCloud's Automatic Analysis is on for this project, so the CI analysis was refused. Turn it off in SonarCloud (Administration, Analysis Method).",
};

/** The gate in a word, and why it could not run when a setting stopped it. */
export function sonarGate(sonar: SonarResult): SonarGate & { blockedReason: string | null } {
  if (sonar.blockedBy) {
    return {
      label: "Analysis blocked",
      tone: "warning",
      blockedReason: BLOCKED_REASONS[sonar.blockedBy] ?? sonar.blockedBy,
    };
  }
  const gate = (sonar.gate ?? "").toUpperCase();
  if (gate === "OK") return { label: "Quality gate passed", tone: "success", blockedReason: null };
  if (gate === "ERROR") return { label: "Quality gate failed", tone: "danger", blockedReason: null };
  if (gate === "WARN") return { label: "Quality gate passed with warnings", tone: "warning", blockedReason: null };
  return { label: "Quality gate not read", tone: "muted", blockedReason: null };
}

/** Whether SonarCloud said anything worth a panel. */
export function hasSonarDetail(sonar: SonarResult | undefined): sonar is SonarResult {
  if (!sonar) return false;
  const lists = [sonar.failedConditions ?? [], Object.keys(sonar.measures ?? {}), sonar.issues ?? []];
  return Boolean(sonar.gate) || Boolean(sonar.blockedBy) || lists.some((list) => list.length > 0);
}

/** "src/app.ts:12", or null without a file. */
export function sonarIssueWhere(issue: { file?: string; line?: number }): string | null {
  if (!issue.file) return null;
  return issue.line !== undefined ? `${issue.file}:${String(issue.line)}` : issue.file;
}

/** "Major", "Blocker", … from SonarCloud's upper-case severity. */
export function sonarSeverityLabel(severity: string | undefined): string | null {
  if (!severity) return null;
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
}
