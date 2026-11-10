BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM projects.qa_progress_events) THEN
    RAISE EXCEPTION 'Progress history exists. Archive it before an explicitly approved data-removing rollback.';
  END IF;
END $$;
DROP TRIGGER IF EXISTS qa_progress_history ON projects.qa_checklist_items;
DROP TRIGGER IF EXISTS qa_category_requirement_changed ON projects.qa_test_case_categories;
DROP TRIGGER IF EXISTS qa_case_requirement_changed ON projects.qa_test_cases;
DROP FUNCTION IF EXISTS projects.record_qa_progress_event();
DROP FUNCTION IF EXISTS projects.touch_qa_test_definition_requirement();
DROP TABLE IF EXISTS projects.qa_progress_events;
COMMIT;
