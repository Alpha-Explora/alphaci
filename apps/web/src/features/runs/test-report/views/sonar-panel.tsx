"use client";

import "./test-report.css";

import { useId } from "react";

import {
  hasSonarDetail,
  sonarCondition,
  sonarGate,
  sonarIssueWhere,
  sonarMeasures,
  sonarSeverityLabel,
  type SonarResult,
} from "../model/sonar-rules";

/**
 * What SonarCloud said about a Quality run, in the product: the gate, each
 * failed condition as a sentence, the headline measures, and the most severe
 * issues on new code with the file and line to fix. Nothing when SonarCloud
 * reported nothing (no credentials, or a pipeline that does not collect it).
 */
export function SonarPanel({ sonar }: Readonly<{ sonar: SonarResult | undefined }>) {
  const headingId = useId();
  if (!hasSonarDetail(sonar)) return null;
  const gate = sonarGate(sonar);
  const measures = sonarMeasures(sonar.measures);
  const conditions = sonar.failedConditions ?? [];
  const issues = sonar.issues ?? [];
  return (
    <section className="tr-sonar" aria-labelledby={headingId}>
      <div className="tr-sonar__head">
        <h6 id={headingId} className="tr-cases__heading">
          SonarCloud
        </h6>
        <span className="tr-case__status" data-tone={gate.tone}>
          <span className="tr-case__dot" aria-hidden="true" />
          {gate.label}
        </span>
      </div>
      {gate.blockedReason ? <p className="tr-sonar__blocked">{gate.blockedReason}</p> : null}
      {conditions.length > 0 ? (
        <ul className="tr-sonar__conditions" aria-label="Failed conditions">
          {conditions.map((condition, index) => (
            <li key={`${String(index)}-${condition.metric}`}>{sonarCondition(condition)}</li>
          ))}
        </ul>
      ) : null}
      {measures.length > 0 ? (
        <dl className="tr-sonar__measures" aria-label="Measures">
          {measures.map((measure) => (
            <div key={measure.metric} className="tr-sonar__measure">
              <dt>{measure.label}</dt>
              <dd>{measure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {issues.length > 0 ? (
        <div className="tr-sonar__issues">
          <p className="tr-sonar__issues-title">
            Issues on new code · {issues.length} most severe
          </p>
          <ol className="tr-sonar__issue-list">
            {issues.map((issue, index) => {
              const where = sonarIssueWhere(issue);
              const severity = sonarSeverityLabel(issue.severity);
              return (
                <li key={`${String(index)}-${issue.rule}`} className="tr-sonar__issue">
                  <span className="tr-sonar__issue-message">{issue.message}</span>
                  <span className="tr-sonar__issue-meta">
                    {[severity, where, issue.rule].filter((part): part is string => Boolean(part)).join(" · ")}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
