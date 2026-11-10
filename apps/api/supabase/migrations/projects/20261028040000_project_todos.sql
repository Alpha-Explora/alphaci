-- Migration: 20261028040000_project_todos
--
-- Purpose: Team to-dos. Engineering and QA action items that are not User
-- stories ("Rotate the staging secret", "Resolve the uat merge conflict"),
-- per Project, with an optional assignee, due date and priority.
--
-- Cross-context note: delivery_project_id, assignee_id and created_by are
-- plain UUIDs with no foreign key, like the other QA tables
-- (scripts/check-schema-ownership.cjs). Project deletion removes the rows
-- through DELIVERY_PROJECT_DATA_CLEANUP.
-- Additive and idempotent.
CREATE TABLE IF NOT EXISTS projects.project_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_project_id UUID NOT NULL,
  title TEXT NOT NULL
    CONSTRAINT project_todos_title_chk CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  notes TEXT NULL
    CONSTRAINT project_todos_notes_chk CHECK (notes IS NULL OR char_length(notes) <= 2000),
  assignee_id UUID NULL,
  assignee_login TEXT NULL,
  due_date DATE NULL,
  priority TEXT NULL
    CONSTRAINT project_todos_priority_chk
      CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CONSTRAINT project_todos_status_chk CHECK (status IN ('open', 'done')),
  created_by UUID NOT NULL,
  created_by_login TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  completed_by_login TEXT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT project_todos_done_shape_chk CHECK (
    (status = 'open' AND completed_at IS NULL)
    OR (status = 'done' AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_project_todos_project
  ON projects.project_todos (delivery_project_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_project_todos_open_assignee
  ON projects.project_todos (assignee_id)
  WHERE status = 'open';

ALTER TABLE projects.project_todos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON projects.project_todos FROM anon, authenticated;
