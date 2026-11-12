BEGIN;
DROP INDEX IF EXISTS projects.idx_qa_checklist_items_due_date;
ALTER TABLE projects.qa_checklist_items
  DROP CONSTRAINT IF EXISTS qa_checklist_items_priority_chk,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS due_date;
COMMIT;
