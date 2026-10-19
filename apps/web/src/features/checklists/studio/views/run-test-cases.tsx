"use client";

import "./test-cases.css";

import { useId, type FormEvent, type ReactNode } from "react";

import type { ProjectQaRunItem } from "../../model/project-run-types";
import {
  countTestCases,
  testCasesAttentionLabel,
  testCasesProgressLabel,
  testCaseStatusChoices,
  testCaseStatusLabel,
  testCaseTone,
} from "../../model/test-case-rules";
import type { RunTestCase, RunTestCategory, TestCaseForm } from "../../model/test-case-types";
import type { RunTestCasesViewModel } from "../view-models/use-run-test-cases-view-model";

type Props = Readonly<{ item: ProjectQaRunItem; vm: RunTestCasesViewModel; onReload: () => void }>;

function formOf<M extends TestCaseForm["mode"]>(
  vm: RunTestCasesViewModel,
  item: ProjectQaRunItem,
  mode: M,
  match: (form: Extract<TestCaseForm, { mode: M }>) => boolean = () => true,
): Extract<TestCaseForm, { mode: M }> | null {
  const form = vm.form;
  if (!form || form.itemId !== item.id || form.mode !== mode) return null;
  const typed = form as Extract<TestCaseForm, { mode: M }>;
  return match(typed) ? typed : null;
}

/** The small inline form every add, rename, edit and note uses. */
function InlineForm({
  item,
  vm,
  label,
  submitLabel,
  children,
}: Readonly<{ item: ProjectQaRunItem; vm: RunTestCasesViewModel; label: string; submitLabel: string; children: ReactNode }>) {
  const saving = vm.busyKey === "form";
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.submitForm(item);
  }
  return (
    <form className="pqa-tests__form" aria-label={label} onSubmit={handleSubmit} noValidate>
      {children}
      {vm.formError ? (
        <p className="qa-form-error" role="alert">
          {vm.formError}
        </p>
      ) : null}
      <div className="pqa-tests__form-actions">
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="ghost-button" disabled={saving} onClick={vm.closeForm}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  placeholder,
  multiline,
  autoFocus,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="hier-field qa-editor-field">
      <span className="hier-field-label">{label}</span>
      {multiline ? (
        <textarea
          className="hier-textarea"
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="hier-input"
          value={value}
          placeholder={placeholder}
          // Opened by a click on Add or Edit: the field it opened is where typing goes.
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

/** Delete, then "Delete?" with Yes and No: a removed test case takes its results in open runs with it. */
function DeleteButton({
  vm,
  confirmKey,
  label,
  onConfirm,
}: Readonly<{ vm: RunTestCasesViewModel; confirmKey: string; label: string; onConfirm: () => void }>) {
  const busy = vm.busyKey !== null;
  if (vm.confirmingDelete === confirmKey) {
    return (
      <span className="pqa-tests__confirm" role="group" aria-label={`Confirm: ${label}`}>
        <span>Delete?</span>
        <button type="button" className="qa-text-button pqa-tests__danger" disabled={busy} onClick={onConfirm}>
          Yes
        </button>
        <button type="button" className="qa-text-button" disabled={busy} onClick={vm.cancelDelete}>
          No
        </button>
      </span>
    );
  }
  return (
    <button type="button" className="qa-text-button" aria-label={label} disabled={busy} onClick={() => vm.askDelete(confirmKey)}>
      Delete
    </button>
  );
}

function ResultControl({ item, testCase, vm }: Readonly<{ item: ProjectQaRunItem; testCase: RunTestCase; vm: RunTestCasesViewModel }>) {
  if (!vm.canRecord || testCase.rowVersion === null) {
    return (
      <span className="pqa-test__status" data-tone={testCaseTone(testCase.status)}>
        {testCaseStatusLabel(testCase.status)}
      </span>
    );
  }
  return (
    <select
      className="hier-select pqa-test__select"
      data-tone={testCaseTone(testCase.status)}
      aria-label={`Result of ${testCase.title}`}
      value={testCase.status}
      disabled={vm.busyKey !== null}
      onChange={(event) => vm.setResult(item, testCase, event.target.value as RunTestCase["status"])}
    >
      {testCaseStatusChoices(testCase.status).map((status) => (
        <option key={status} value={status}>
          {testCaseStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}

function NoteArea({ item, testCase, vm }: Readonly<{ item: ProjectQaRunItem; testCase: RunTestCase; vm: RunTestCasesViewModel }>) {
  const form = formOf(vm, item, "note", (open) => open.runTestCaseId === testCase.id);
  if (form) {
    return (
      <InlineForm item={item} vm={vm} label={`Note on ${testCase.title}`} submitLabel="Save note">
        <TextField
          label="Note"
          value={form.notes}
          multiline
          placeholder={testCase.status === "failed" ? "What went wrong" : "Anything worth knowing"}
          onChange={(notes) => vm.updateForm({ notes })}
        />
      </InlineForm>
    );
  }
  return testCase.notes ? <p className="pqa-test__note">{testCase.notes}</p> : null;
}

type RowProps = Readonly<{ item: ProjectQaRunItem; testCase: RunTestCase; vm: RunTestCasesViewModel }>;

/** Add note: anyone recording results, while no note form is open on it. */
function NoteButton({ item, testCase, vm }: RowProps) {
  const noting = formOf(vm, item, "note", (open) => open.runTestCaseId === testCase.id) !== null;
  const rowVersion = testCase.rowVersion;
  if (!vm.canRecord || noting || rowVersion === null) return null;
  return (
    <button
      type="button"
      className="qa-text-button"
      disabled={vm.busyKey !== null}
      onClick={() =>
        vm.openForm({ mode: "note", itemId: item.id, runTestCaseId: testCase.id, rowVersion, notes: testCase.notes ?? "" })
      }
    >
      {testCase.notes ? "Edit note" : "Add note"}
    </button>
  );
}

/** Edit and Delete: the QA Team and admins, on a test case whose definition still exists. */
function ManageButtons({ item, testCase, vm }: RowProps) {
  const sourceId = testCase.sourceTestCaseId;
  if (!vm.canManage(item) || sourceId === null) return null;
  const definitionRowVersion = testCase.definitionRowVersion;
  return (
    <>
      {definitionRowVersion !== null ? (
        <button
          type="button"
          className="qa-text-button"
          disabled={vm.busyKey !== null}
          onClick={() =>
            vm.openForm({
              mode: "edit-case",
              itemId: item.id,
              testCaseId: sourceId,
              rowVersion: definitionRowVersion,
              title: testCase.title,
              expectedResult: testCase.expectedResult ?? "",
            })
          }
        >
          Edit
        </button>
      ) : null}
      <DeleteButton
        vm={vm}
        confirmKey={`case:${testCase.id}`}
        label={`Delete test case ${testCase.title}`}
        onConfirm={() => void vm.deleteTestCase(item, testCase)}
      />
    </>
  );
}

function TestCaseActions(props: RowProps) {
  return (
    <div className="pqa-test__actions">
      <NoteButton {...props} />
      <ManageButtons {...props} />
    </div>
  );
}

function EditTestCase({
  item,
  testCase,
  vm,
  form,
}: RowProps & Readonly<{ form: Extract<TestCaseForm, { mode: "edit-case" }> }>) {
  return (
    <li className="pqa-test pqa-test--editing">
      <InlineForm item={item} vm={vm} label={`Edit ${testCase.title}`} submitLabel="Save test case">
        <TextField label="Test case" value={form.title} autoFocus onChange={(title) => vm.updateForm({ title })} />
        <TextField
          label="Expected result (optional)"
          value={form.expectedResult}
          multiline
          onChange={(expectedResult) => vm.updateForm({ expectedResult })}
        />
      </InlineForm>
    </li>
  );
}

function TestCaseRow({ item, testCase, vm }: RowProps) {
  const editing = formOf(vm, item, "edit-case", (open) => open.testCaseId === testCase.sourceTestCaseId);
  if (editing) return <EditTestCase item={item} testCase={testCase} vm={vm} form={editing} />;
  return (
    <li className="pqa-test" data-status={testCase.status}>
      <div className="pqa-test__head">
        <span className="pqa-test__title">{testCase.title}</span>
        <ResultControl item={item} testCase={testCase} vm={vm} />
      </div>
      {testCase.expectedResult ? (
        <p className="pqa-test__expected">
          <span className="pqa-test__expected-label">Expected:</span> {testCase.expectedResult}
        </p>
      ) : null}
      <NoteArea item={item} testCase={testCase} vm={vm} />
      {vm.busyKey === testCase.id ? (
        <span className="qa-run-item__saving" role="status">
          Saving…
        </span>
      ) : null}
      <TestCaseActions item={item} testCase={testCase} vm={vm} />
    </li>
  );
}

function CategoryHead({ item, category, vm }: Readonly<{ item: ProjectQaRunItem; category: RunTestCategory; vm: RunTestCasesViewModel }>) {
  const renaming = formOf(vm, item, "rename-category", (open) => open.categoryId === category.id);
  const manage = vm.canManage(item) && category.id !== null;
  if (renaming) {
    return (
      <InlineForm item={item} vm={vm} label={`Rename ${category.name}`} submitLabel="Rename">
        <TextField label="Category" value={renaming.name} autoFocus onChange={(name) => vm.updateForm({ name })} />
      </InlineForm>
    );
  }
  return (
    <div className="pqa-tests__category-head">
      <h5 className="pqa-tests__category-name">{category.name}</h5>
      {manage ? (
        <span className="pqa-tests__category-actions">
          {category.rowVersion !== null ? (
            <button
              type="button"
              className="qa-text-button"
              disabled={vm.busyKey !== null}
              onClick={() =>
                vm.openForm({
                  mode: "rename-category",
                  itemId: item.id,
                  categoryId: category.id ?? "",
                  rowVersion: category.rowVersion ?? 0,
                  name: category.name,
                })
              }
            >
              Rename
            </button>
          ) : null}
          <DeleteButton
            vm={vm}
            confirmKey={`category:${category.id ?? ""}`}
            label={`Delete category ${category.name} and its test cases`}
            onConfirm={() => void vm.deleteCategory(item, category)}
          />
        </span>
      ) : null}
    </div>
  );
}

function AddTestCase({ item, category, vm }: Readonly<{ item: ProjectQaRunItem; category: RunTestCategory; vm: RunTestCasesViewModel }>) {
  const adding = formOf(vm, item, "add-case", (open) => open.categoryId === category.id);
  if (!vm.canManage(item) || category.id === null) return null;
  if (adding) {
    return (
      <InlineForm item={item} vm={vm} label={`New test case in ${category.name}`} submitLabel="Add test case">
        <TextField
          label="Test case"
          value={adding.title}
          autoFocus
          placeholder="Log in with a saved password"
          onChange={(title) => vm.updateForm({ title })}
        />
        <TextField
          label="Expected result (optional)"
          value={adding.expectedResult}
          multiline
          placeholder="The profile shows in the header"
          onChange={(expectedResult) => vm.updateForm({ expectedResult })}
        />
      </InlineForm>
    );
  }
  return (
    <button
      type="button"
      className="qa-text-button pqa-tests__add"
      disabled={vm.busyKey !== null}
      onClick={() =>
        vm.openForm({ mode: "add-case", itemId: item.id, categoryId: category.id ?? "", title: "", expectedResult: "" })
      }
    >
      + Add test case
    </button>
  );
}

function AddCategory({ item, vm }: Readonly<{ item: ProjectQaRunItem; vm: RunTestCasesViewModel }>) {
  const adding = formOf(vm, item, "add-category");
  if (!vm.canManage(item)) return null;
  if (adding) {
    return (
      <InlineForm item={item} vm={vm} label="New test case category" submitLabel="Add category">
        <TextField
          label="Category"
          value={adding.name}
          autoFocus
          placeholder="Happy path"
          onChange={(name) => vm.updateForm({ name })}
        />
      </InlineForm>
    );
  }
  return (
    <button
      type="button"
      className="qa-text-button pqa-tests__add"
      disabled={vm.busyKey !== null}
      onClick={() => vm.openForm({ mode: "add-category", itemId: item.id, name: "" })}
    >
      + Add test case category
    </button>
  );
}

function SectionError({ item, vm, onReload }: Props) {
  const error = vm.error;
  if (!error || error.itemId !== item.id) return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{error.message}</p>
      {error.stale ? (
        <button type="button" className="ghost-button" onClick={onReload}>
          Reload run
        </button>
      ) : (
        <button type="button" className="qa-text-button" onClick={vm.dismissError}>
          Dismiss
        </button>
      )}
    </div>
  );
}

/**
 * A story's test cases in this run, by category, each with QA's result. The
 * QA Team and admins add categories and test cases here; anyone verifying
 * records a result per test case. Hidden on a System item, and on a story
 * with no test cases for a viewer who cannot add any.
 */
export function RunTestCases({ item, vm, onReload }: Props) {
  const headingId = useId();
  if (item.requirementKind !== "functional") return null;
  const categories = item.testCategories;
  const manage = vm.canManage(item);
  if (categories.length === 0 && !manage) return null;
  const counts = countTestCases(categories);
  const attention = testCasesAttentionLabel(counts);
  return (
    <details className="pqa-tests" open={counts.open > 0 || counts.total === 0}>
      <summary className="pqa-tests__summary" id={headingId}>
        <span className="pqa-tests__label">Test cases</span>
        <span className="pqa-tests__count">{testCasesProgressLabel(counts)}</span>
        {attention ? <span className="pqa-tests__attention">{attention}</span> : null}
      </summary>
      <div className="pqa-tests__body" role="group" aria-labelledby={headingId}>
        {categories.map((category) => (
          <section key={category.id ?? `name:${category.name}`} className="pqa-tests__category">
            <CategoryHead item={item} category={category} vm={vm} />
            {category.testCases.length > 0 ? (
              <ul className="pqa-tests__list">
                {category.testCases.map((testCase) => (
                  <TestCaseRow key={testCase.id} item={item} testCase={testCase} vm={vm} />
                ))}
              </ul>
            ) : (
              <p className="pqa-tests__empty">No test cases in this category yet.</p>
            )}
            <AddTestCase item={item} category={category} vm={vm} />
          </section>
        ))}
        <AddCategory item={item} vm={vm} />
        <SectionError item={item} vm={vm} onReload={onReload} />
      </div>
    </details>
  );
}
