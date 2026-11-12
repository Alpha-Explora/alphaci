-- Migration: 20261028030000_backlog_schedule
--
-- Purpose: a User story in the backlog carries an optional due date and
-- priority (low, medium, high, urgent). Scheduling is not a definition
-- change: it does not bump row_version or reopen QA review.
-- Additive and idempotent.
ALTER TABLE projects.qa_checklist_items
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS priority TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects.qa_checklist_items'::regclass
      AND conname = 'qa_checklist_items_priority_chk'
  ) THEN
    ALTER TABLE projects.qa_checklist_items
      ADD CONSTRAINT qa_checklist_items_priority_chk
        CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END $$;

-- "What is due next" across a Project's backlog.
CREATE INDEX IF NOT EXISTS idx_qa_checklist_items_due_date
  ON projects.qa_checklist_items (due_date)
  WHERE due_date IS NOT NULL;
