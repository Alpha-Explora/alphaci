-- Migration: 20261029000000_iteration_version_patch
--
-- Purpose: add the third release number, so versions read vMajor.Minor.Patch.
-- Starting the next Iteration can now be a Patch revision (v1.2.0 -> v1.2.1,
-- fixes only) besides Minor (v1.2.0 -> v1.3.0) and Major (v1.2.0 -> v2.0.0).
--
-- Builds on 20261028020000_iteration_versions. Existing Iterations get
-- patch 0, so v1.2 becomes v1.2.0. The trigger still fills a version an
-- insert left out (next minor, patch 0), so a backend that knows only two
-- numbers keeps working while this migration is live.
--
-- Idempotent.
ALTER TABLE projects.project_iterations
  ADD COLUMN IF NOT EXISTS version_patch INTEGER;

UPDATE projects.project_iterations SET version_patch = 0 WHERE version_patch IS NULL;

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
    NEW.version_patch := 0;
  END IF;
  NEW.version_patch := COALESCE(NEW.version_patch, 0);
  NEW.revision_type := COALESCE(NEW.revision_type, 'minor');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION projects.default_iteration_version() FROM PUBLIC;

ALTER TABLE projects.project_iterations
  ALTER COLUMN version_patch SET NOT NULL;

-- Replaced so 'patch' is an allowed revision type and patch is never negative.
ALTER TABLE projects.project_iterations
  DROP CONSTRAINT IF EXISTS project_iterations_revision_type_chk,
  DROP CONSTRAINT IF EXISTS project_iterations_version_chk;
ALTER TABLE projects.project_iterations
  ADD CONSTRAINT project_iterations_revision_type_chk
    CHECK (revision_type IN ('major', 'minor', 'patch')),
  ADD CONSTRAINT project_iterations_version_chk
    CHECK (version_major >= 1 AND version_minor >= 0 AND version_patch >= 0);

-- Each version once per Project. The two-number index would refuse v1.2.1
-- beside v1.2.0, so it is dropped once this one exists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_iterations_semver
  ON projects.project_iterations (delivery_project_id, version_major, version_minor, version_patch);
DROP INDEX IF EXISTS projects.uq_project_iterations_version;
