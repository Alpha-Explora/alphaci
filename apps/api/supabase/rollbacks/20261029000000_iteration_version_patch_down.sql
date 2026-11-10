BEGIN;
-- Refuses to run while two Iterations of a Project differ only by patch.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_iterations_version
  ON projects.project_iterations (delivery_project_id, version_major, version_minor);
DROP INDEX IF EXISTS projects.uq_project_iterations_semver;
UPDATE projects.project_iterations SET revision_type = 'minor' WHERE revision_type = 'patch';
ALTER TABLE projects.project_iterations
  DROP CONSTRAINT IF EXISTS project_iterations_revision_type_chk,
  DROP CONSTRAINT IF EXISTS project_iterations_version_chk;
ALTER TABLE projects.project_iterations
  ADD CONSTRAINT project_iterations_revision_type_chk CHECK (revision_type IN ('major', 'minor')),
  ADD CONSTRAINT project_iterations_version_chk CHECK (version_major >= 1 AND version_minor >= 0);
CREATE OR REPLACE FUNCTION projects.default_iteration_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  latest RECORD;
BEGIN
  IF NEW.version_major IS NULL OR NEW.version_minor IS NULL THEN
    SELECT version_major, version_minor INTO latest
    FROM projects.project_iterations
    WHERE delivery_project_id = NEW.delivery_project_id
    ORDER BY number DESC
    LIMIT 1;
    IF FOUND THEN
      NEW.version_major := latest.version_major;
      NEW.version_minor := latest.version_minor + 1;
      NEW.revision_type := COALESCE(NEW.revision_type, 'minor');
    ELSE
      NEW.version_major := 1;
      NEW.version_minor := 0;
      NEW.revision_type := COALESCE(NEW.revision_type, 'major');
    END IF;
  END IF;
  NEW.revision_type := COALESCE(NEW.revision_type, 'minor');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION projects.default_iteration_version() FROM PUBLIC;
ALTER TABLE projects.project_iterations DROP COLUMN IF EXISTS version_patch;
COMMIT;
