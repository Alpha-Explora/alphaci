-- Transactional history, including progress resets initiated by QA. No historical
-- backfill: old values cannot be reconstructed from the current checklist.
CREATE TABLE IF NOT EXISTS projects.qa_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_project_id UUID NOT NULL,
  iteration_id UUID NOT NULL REFERENCES projects.project_iterations(id) ON DELETE CASCADE,
  -- Stable source identity: deleting the definition must not erase its history.
  source_item_id UUID NOT NULL,
  title TEXT NOT NULL,
  requirement_name TEXT NOT NULL,
  actor_user_id UUID NULL,
  actor_login TEXT NULL,
  from_status TEXT NOT NULL CHECK (from_status IN ('todo', 'in_progress', 'done')),
  to_status TEXT NOT NULL CHECK (to_status IN ('todo', 'in_progress', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS qa_progress_events_project_page
  ON projects.qa_progress_events(delivery_project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS qa_progress_events_iteration
  ON projects.qa_progress_events(iteration_id);
CREATE INDEX IF NOT EXISTS qa_progress_events_item_page
  ON projects.qa_progress_events(source_item_id, created_at DESC, id DESC);
ALTER TABLE projects.qa_progress_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON projects.qa_progress_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION projects.record_qa_progress_event()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO projects.qa_progress_events (
    delivery_project_id, iteration_id, source_item_id, title, requirement_name,
    actor_user_id, actor_login, from_status, to_status
  )
  SELECT c.delivery_project_id, c.iteration_id, NEW.id, NEW.title, c.name,
         NEW.progress_by, NEW.progress_by_login, OLD.progress, NEW.progress
  FROM projects.qa_checklists c
  WHERE c.id = NEW.checklist_id AND c.delivery_project_id IS NOT NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION projects.record_qa_progress_event() FROM PUBLIC;
DROP TRIGGER IF EXISTS qa_progress_history ON projects.qa_checklist_items;
CREATE TRIGGER qa_progress_history AFTER UPDATE OF progress
  ON projects.qa_checklist_items FOR EACH ROW
  WHEN (OLD.progress <> NEW.progress)
  EXECUTE FUNCTION projects.record_qa_progress_event();

-- Editing QA definitions after a sign-off must close the release gate, even
-- though the signed-off run's own test-case copies remain frozen.
CREATE OR REPLACE FUNCTION projects.touch_qa_test_definition_requirement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE story UUID;
BEGIN
  IF TG_TABLE_NAME = 'qa_test_case_categories' THEN
    IF TG_OP = 'DELETE' THEN story := OLD.item_id; ELSE story := NEW.item_id; END IF;
  ELSE
    SELECT item_id INTO story FROM projects.qa_test_case_categories
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.category_id ELSE NEW.category_id END;
  END IF;
  UPDATE projects.qa_checklists SET updated_at = clock_timestamp(), version = version + 1
  WHERE id = (SELECT checklist_id FROM projects.qa_checklist_items WHERE id = story);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION projects.touch_qa_test_definition_requirement() FROM PUBLIC;
DROP TRIGGER IF EXISTS qa_category_requirement_changed ON projects.qa_test_case_categories;
CREATE TRIGGER qa_category_requirement_changed AFTER INSERT OR UPDATE OR DELETE
  ON projects.qa_test_case_categories FOR EACH ROW
  EXECUTE FUNCTION projects.touch_qa_test_definition_requirement();
DROP TRIGGER IF EXISTS qa_case_requirement_changed ON projects.qa_test_cases;
CREATE TRIGGER qa_case_requirement_changed AFTER INSERT OR UPDATE OR DELETE
  ON projects.qa_test_cases FOR EACH ROW
  EXECUTE FUNCTION projects.touch_qa_test_definition_requirement();
