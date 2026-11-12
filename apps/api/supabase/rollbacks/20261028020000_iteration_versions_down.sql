BEGIN;
DROP TRIGGER IF EXISTS project_iteration_default_version ON projects.project_iterations;
DROP FUNCTION IF EXISTS projects.default_iteration_version();
DROP INDEX IF EXISTS projects.uq_project_iterations_version;
ALTER TABLE projects.project_iterations
  DROP CONSTRAINT IF EXISTS project_iterations_version_chk,
  DROP CONSTRAINT IF EXISTS project_iterations_revision_type_chk,
  DROP COLUMN IF EXISTS revision_type,
  DROP COLUMN IF EXISTS version_minor,
  DROP COLUMN IF EXISTS version_major;
COMMIT;
