"use client";

import { useState } from "react";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import { testCasesRepository } from "../../data/test-cases-repository";
import type { ProjectQaRun, ProjectQaRunItem, ProjectQaRunPermissions } from "../../model/project-run-types";
import { qaActionError } from "../../model/qa-run-rules";
import { blankToNull, testCaseFormError } from "../../model/test-case-rules";
import type { RunTestCase, RunTestCategory, TestCaseForm, TestCaseStatus } from "../../model/test-case-types";

export interface RunTestCasesError {
  itemId: string;
  message: string;
  /** A reload fixes it (someone else changed the test case or the run). */
  stale: boolean;
}

export interface RunTestCasesViewModel {
  /** Whether this viewer may write test cases under this story here (QA Team or admin, open run, a Feature's story). */
  canManage: (item: ProjectQaRunItem) => boolean;
  /** Whether this viewer may record results on this run (the Verification track). */
  canRecord: boolean;
  /** The test case, category or form whose write is in flight. */
  busyKey: string | null;
  form: TestCaseForm | null;
  /** Why the open form cannot be sent yet. Shown once Save was tried. */
  formError: string | null;
  error: RunTestCasesError | null;
  /** `category:<id>` or `case:<id>` while its Delete waits for a second click. */
  confirmingDelete: string | null;
  setResult: (item: ProjectQaRunItem, testCase: RunTestCase, status: TestCaseStatus) => void;
  openForm: (form: TestCaseForm) => void;
  updateForm: (patch: Partial<Record<"name" | "title" | "expectedResult" | "notes", string>>) => void;
  closeForm: () => void;
  submitForm: (item: ProjectQaRunItem) => Promise<void>;
  askDelete: (key: string) => void;
  cancelDelete: () => void;
  deleteCategory: (item: ProjectQaRunItem, category: RunTestCategory) => Promise<void>;
  deleteTestCase: (item: ProjectQaRunItem, testCase: RunTestCase) => Promise<void>;
  dismissError: () => void;
}

const RESULT_ERROR = "The test case result could not be saved. Try again in a moment.";
const WRITE_ERROR = "The test cases could not be saved. Try again in a moment.";

/** The story behind a run item, when test cases can be written for it. */
function storyOf(item: ProjectQaRunItem): { requirementId: string; itemId: string } | null {
  if (item.requirementKind !== "functional" || !item.requirementId || !item.sourceItemId) return null;
  return { requirementId: item.requirementId, itemId: item.sourceItemId };
}

type Story = { requirementId: string; itemId: string };

/** The definition write a form sends, or null for a note (a result write, not a definition). */
function definitionWrite(form: TestCaseForm): ((story: Story) => Promise<unknown>) | null {
  switch (form.mode) {
    case "add-category":
      return (story) => testCasesRepository.addCategory(story.requirementId, story.itemId, form.name.trim());
    case "rename-category":
      return (story) =>
        testCasesRepository.renameCategory(story.requirementId, story.itemId, form.categoryId, {
          name: form.name.trim(),
          expectedRowVersion: form.rowVersion,
        });
    case "add-case":
      return (story) =>
        testCasesRepository.addTestCase(story.requirementId, story.itemId, form.categoryId, {
          title: form.title.trim(),
          expectedResult: blankToNull(form.expectedResult),
        });
    case "edit-case":
      return (story) =>
        testCasesRepository.updateTestCase(story.requirementId, story.itemId, form.testCaseId, {
          title: form.title.trim(),
          expectedResult: blankToNull(form.expectedResult),
          expectedRowVersion: form.rowVersion,
        });
    case "note":
      return null;
  }
}

/**
 * ViewModel for the Test cases section of each story in a Project run.
 *
 * Results save the moment they are picked, on the Verification track (QA
 * Team, Product owners, admins), and carry the run copy's row version. The
 * QA Team and admins also write the test cases themselves: categories and
 * test cases are saved on the story, and the server copies them into the
 * open run, so every definition write reads the run again. One form is open
 * at a time; a delete asks for a second click.
 */
export function useRunTestCasesViewModel(options: {
  deliveryProjectId: string;
  run: ProjectQaRun;
  permissions: ProjectQaRunPermissions;
  onRun: (run: ProjectQaRun) => void;
  onReload: () => void;
}): RunTestCasesViewModel {
  const { deliveryProjectId, run, permissions, onRun, onReload } = options;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [form, setForm] = useState<TestCaseForm | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<RunTestCasesError | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const open = run.status === "open";
  // The QA Team records results; a Product owner reads them.
  const canRecord = open && permissions.canRecordTestCases;
  const canManage = (item: ProjectQaRunItem) => open && permissions.canManageTestCases && storyOf(item) !== null;

  function closeForm() {
    setForm(null);
    setAttempted(false);
  }

  async function write(item: ProjectQaRunItem, key: string, fallback: string, action: () => Promise<ProjectQaRun | null>) {
    setBusyKey(key);
    setError(null);
    try {
      const saved = await action();
      if (saved) onRun(saved);
      else onReload();
      return true;
    } catch (cause) {
      setError({ itemId: item.id, ...qaActionError(cause, fallback) });
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  /** A definition write: the reply is the story's set, so the run (which the server re-synced) is read again. */
  async function define(item: ProjectQaRunItem, key: string, action: (story: Story) => Promise<unknown>) {
    const story = storyOf(item);
    if (!story || !canManage(item)) return false;
    return write(item, key, WRITE_ERROR, async () => {
      await action(story);
      return null;
    });
  }

  function setResult(item: ProjectQaRunItem, testCase: RunTestCase, status: TestCaseStatus) {
    if (!canRecord || busyKey || status === testCase.status || testCase.rowVersion === null) return;
    const expectedRowVersion = testCase.rowVersion;
    void write(item, testCase.id, RESULT_ERROR, () =>
      projectQaRunsRepository.setTestCaseResult(deliveryProjectId, run.id, item.id, testCase.id, {
        status,
        expectedRowVersion,
      }),
    );
  }

  async function saveNote(item: ProjectQaRunItem, form: Extract<TestCaseForm, { mode: "note" }>) {
    if (!canRecord) return false;
    return write(item, "form", RESULT_ERROR, () =>
      projectQaRunsRepository.setTestCaseResult(deliveryProjectId, run.id, item.id, form.runTestCaseId, {
        notes: blankToNull(form.notes),
        expectedRowVersion: form.rowVersion,
      }),
    );
  }

  async function submitForm(item: ProjectQaRunItem) {
    if (!form || busyKey || form.itemId !== item.id) return;
    setAttempted(true);
    if (testCaseFormError(form)) return;
    const action = definitionWrite(form);
    const saved = form.mode === "note" ? await saveNote(item, form) : action ? await define(item, "form", action) : false;
    if (saved) closeForm();
  }

  async function deleteCategory(item: ProjectQaRunItem, category: RunTestCategory) {
    const categoryId = category.id;
    if (!categoryId) return;
    setConfirmingDelete(null);
    await define(item, `category:${categoryId}`, (story) =>
      testCasesRepository.deleteCategory(story.requirementId, story.itemId, categoryId),
    );
  }

  async function deleteTestCase(item: ProjectQaRunItem, testCase: RunTestCase) {
    const testCaseId = testCase.sourceTestCaseId;
    if (!testCaseId) return;
    setConfirmingDelete(null);
    await define(item, `case:${testCase.id}`, (story) =>
      testCasesRepository.deleteTestCase(story.requirementId, story.itemId, testCaseId),
    );
  }

  return {
    canManage,
    canRecord,
    busyKey,
    form,
    formError: attempted && form ? testCaseFormError(form) : null,
    error,
    confirmingDelete,
    setResult,
    openForm: (next) => {
      setForm(next);
      setAttempted(false);
      setError(null);
      setConfirmingDelete(null);
    },
    updateForm: (patch) => setForm((current) => (current ? ({ ...current, ...patch } as TestCaseForm) : current)),
    closeForm,
    submitForm,
    askDelete: (key) => setConfirmingDelete(key),
    cancelDelete: () => setConfirmingDelete(null),
    deleteCategory,
    deleteTestCase,
    dismissError: () => setError(null),
  };
}
