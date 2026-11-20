-- Keep report ownership when the provisioned project is disconnected.
-- Deliberately omit a foreign key to the project row, which may be deleted.
ALTER TABLE workflow.ci_run_reports ADD COLUMN IF NOT EXISTS project_id uuid;

-- Match only reports from the current project lifetime and original owner.
-- Leave ambiguous and disconnected history intact without making it visible to a new project.
WITH candidates AS (
  SELECT report.id AS report_id, (array_agg(project.id))[1] AS project_id
    FROM workflow.ci_run_reports report
    JOIN projects.provisioned_projects project
      ON lower(project.repo_full_name) = lower(report.repo_full_name)
     AND project.user_id = report.user_id
     AND project.created_at <= report.created_at
   WHERE report.project_id IS NULL
   GROUP BY report.id
  HAVING count(*) = 1
)
UPDATE workflow.ci_run_reports report
   SET project_id = candidates.project_id
  FROM candidates
 WHERE report.id = candidates.report_id;

CREATE INDEX IF NOT EXISTS idx_ci_run_reports_project_run
  ON workflow.ci_run_reports (project_id, run_id);

CREATE INDEX IF NOT EXISTS idx_ci_run_reports_repo_run_stage
  ON workflow.ci_run_reports (lower(repo_full_name), run_id, stage);
