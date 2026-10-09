/* Test report — what a run's browser tests and SonarCloud said, in detail.
 * Shared by the Project page's Pipeline runs (developers) and QA Studio's
 * Playwright tab, so both read the same records the same way. */
export { TestCaseList } from "./views/test-case-list";
export { SonarPanel } from "./views/sonar-panel";
export {
  casesFromPasses,
  normalizeTestCases,
  testCaseMeta,
  testCaseName,
  testCaseStatusWord,
} from "./model/test-case-rules";
export {
  hasSonarDetail,
  sonarCondition,
  sonarGate,
  sonarIssueWhere,
  sonarMeasures,
  sonarSeverityLabel,
  type SonarResult,
} from "./model/sonar-rules";
