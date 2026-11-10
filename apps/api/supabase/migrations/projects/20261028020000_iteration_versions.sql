-- Migration: 20261028020000_iteration_versions
--
-- Purpose: every Iteration carries a release version, vMajor.Minor. The
-- first Iteration is v1.0; starting the next one is a Minor revision
-- (v1.2 -> v1.3, new features) or a Major one (v1.2 -> v2.0, large or
-- breaking changes). The version appears in the delivery audit event, its
-- notification and the QA report.
--
-- Compatible with a backend that does not know versions: an Iteration
-- inserted without one gets the next minor version from the trigger below,
-- so the previous release keeps starting Iterations while this migration is
-- live and the matching backend is not deployed yet. The columns therefore
-- have no defaults: a default would hide which values an insert left out.
--
-- Backfill: existing Iterations keep their order as v1.0, v1.1, v1.2...
-- Idempotent.
ALTER TABLE projects.project_iterations
  ADD COLUMN IF NOT EXISTS version_major INTEGER,
  ADD COLUMN IF NOT EXISTS version_minor INTEGER,
  ADD COLUMN IF NOT EXISTS revision_type TEXT;

ALTER TABLE projects.project_iterations
  ALTER COLUMN version_major DROP DEFAULT,
  ALTER COLUMN version_minor DROP DEFAULT,
  ALTER COLUMN revision_type DROP DEFAULT;

UPDATE projects.project_iterations
SET version_major = COALESCE(version_major, 1),
    version_minor = COALESCE(version_minor, number - 1),
    revision_type = COALESCE(revision_type, CASE WHEN number = 1 THEN 'major' ELSE 'minor' END)
WHERE version_major IS NULL OR version_minor IS NULL OR revision_type IS NULL;

-- Fills a version an insert left out: v1.0 for a Project's first Iteration,
-- otherwise the next minor version after its latest. NOT NULL is checked
-- after BEFORE ROW triggers, so the columns can be NOT NULL below.
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

DROP TRIGGER IF EXISTS project_iteration_default_version ON projects.project_iterations;
CREATE TRIGGER project_iteration_default_version
  BEFORE INSERT ON projects.project_iterations
  FOR EACH ROW
  EXECUTE FUNCTION projects.default_iteration_version();

ALTER TABLE projects.project_iterations
  ALTER COLUMN version_major SET NOT NULL,
  ALTER COLUMN version_minor SET NOT NULL,
  ALTER COLUMN revision_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_iterations_revision_type_chk') THEN
    ALTER TABLE projects.project_iterations
      ADD CONSTRAINT project_iterations_revision_type_chk CHECK (revision_type IN ('major', 'minor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_iterations_version_chk') THEN
    ALTER TABLE projects.project_iterations
      ADD CONSTRAINT project_iterations_version_chk CHECK (version_major >= 1 AND version_minor >= 0);
  END IF;
END $$;

-- Each version once per Project.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_iterations_version
  ON projects.project_iterations (delivery_project_id, version_major, version_minor);
