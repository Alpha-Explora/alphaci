"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Dialog } from "@/features/groups/workspace";

import type { ProjectQaRunItem } from "../../model/project-run-types";
import type { RunTestCasesViewModel } from "../view-models/use-run-test-cases-view-model";
import { RunTestCases } from "./run-test-cases";

interface FeatureGroup {
  key: string;
  name: string;
  stories: ProjectQaRunItem[];
}

/** The Feature user stories QA may write test cases for, grouped under their Feature in run order. */
function featureGroups(items: ProjectQaRunItem[], vm: RunTestCasesViewModel): FeatureGroup[] {
  const groups = new Map<string, FeatureGroup>();
  for (const item of items) {
    if (item.requirementKind !== "functional" || !vm.canManage(item)) continue;
    const key = item.requirementId ?? `name:${item.requirementName}`;
    const group = groups.get(key) ?? { key, name: item.requirementName, stories: [] };
    group.stories.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function testCaseTotal(item: ProjectQaRunItem): number {
  return item.testCategories.reduce((sum, category) => sum + category.testCases.length, 0);
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** The left rail: each Feature, and under it the user stories to pick from. */
function SuiteRail({
  groups,
  selectedId,
  onSelect,
}: Readonly<{ groups: FeatureGroup[]; selectedId: string; onSelect: (id: string) => void }>) {
  return (
    <nav className="pqa-suite__rail" aria-label="Features and user stories">
      <div className="pqa-suite__rail-list">
        {groups.map((group) => (
          <section key={group.key} className="pqa-suite__feature">
            <p className="pqa-suite__feature-head">
              <span className="pqa-kind" data-kind="functional">
                Feature
              </span>
              <span className="pqa-suite__feature-name" title={group.name}>
                {group.name}
              </span>
            </p>
            <ul className="pqa-suite__stories">
              {group.stories.map((story, index) => {
                const total = testCaseTotal(story);
                const selected = story.id === selectedId;
                return (
                  <li key={story.id}>
                    <button
                      type="button"
                      className="pqa-suite__story"
                      aria-current={selected ? "true" : undefined}
                      data-selected={String(selected)}
                      title={story.title}
                      onClick={() => onSelect(story.id)}
                    >
                      <span className="pqa-suite__story-index">{String(index + 1)}</span>
                      <span className="pqa-suite__story-title">{story.title}</span>
                      <span
                        className="pqa-suite__story-count"
                        aria-label={plural(total, "test case", "test cases")}
                        data-empty={String(total === 0)}
                      >
                        {String(total)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

/** The right pane: the selected story and its categories and test cases. */
function SuitePane({
  story,
  vm,
  onReload,
}: Readonly<{ story: ProjectQaRunItem; vm: RunTestCasesViewModel; onReload: () => void }>) {
  const total = testCaseTotal(story);
  return (
    <div className="pqa-suite__pane">
      <header className="pqa-suite__story-head">
        <p className="pqa-suite__eyebrow">User story · {story.requirementName}</p>
        <h3 className="pqa-suite__story-heading">{story.title}</h3>
        {story.acceptanceCriteria ? (
          <details className="pqa-suite__criteria">
            <summary>Acceptance criteria</summary>
            <p>{story.acceptanceCriteria}</p>
          </details>
        ) : null}
        <p className="pqa-suite__stats">
          {plural(story.testCategories.length, "category", "categories")} · {plural(total, "test case", "test cases")}
        </p>
      </header>
      <RunTestCases item={story} vm={vm} onReload={onReload} managementOnly />
    </div>
  );
}

/** "Are you sure?" over the sheet, before the editor closes. Escape keeps editing. */
function DoneConfirm({
  unsaved,
  onCancel,
  onConfirm,
}: Readonly<{ unsaved: boolean; onCancel: () => void; onConfirm: () => void }>) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    // Keeps the sheet's own Escape handler from also firing.
    event.stopPropagation();
    onCancel();
  }
  return (
    <div className="pqa-suite__confirm-layer" onKeyDown={onKeyDown}>
      <div
        className="pqa-suite__confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pqa-suite-confirm-title"
        aria-describedby="pqa-suite-confirm-text"
      >
        <h3 className="pqa-suite__confirm-title" id="pqa-suite-confirm-title">
          Are you sure you&apos;re done?
        </h3>
        <p className="pqa-suite__confirm-text" id="pqa-suite-confirm-text">
          {unsaved
            ? "A form is still open. What you typed in it has not been saved and will be lost. Everything else is already on the QA checklist."
            : "Your categories and test cases are saved and already show on the QA checklist."}
        </p>
        <div className="pqa-suite__confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Keep editing
          </button>
          <button ref={confirmRef} type="button" className="primary-button" onClick={onConfirm}>
            Yes, I&apos;m done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit test suite: the QA Team writes the test case categories and test
 * cases under each Feature's user stories. Features and their stories sit in
 * the left rail; the selected story's suite is edited on the right. Every
 * change saves at once and reloads the run, so the sidebar checklist shows it
 * straight away. Done (and Escape or the backdrop) asks before closing.
 */
export function TestCaseEditorDialog({
  items,
  vm,
  open,
  onClose,
  onReload,
}: Readonly<{
  items: ProjectQaRunItem[];
  vm: RunTestCasesViewModel;
  open: boolean;
  onClose: () => void;
  onReload: () => void;
}>) {
  const groups = featureGroups(items, vm);
  const stories = groups.flatMap((group) => group.stories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const selected = stories.find((story) => story.id === selectedId) ?? stories[0] ?? null;
  const saving = vm.busyKey !== null;

  function askDone() {
    if (!saving) setConfirming(true);
  }

  function finish() {
    setConfirming(false);
    vm.closeForm();
    onClose();
  }

  return (
    <Dialog open={open} onClose={askDone} title="Edit test suite" size="wide">
      <div className="hier-dialog-form pqa-suite-shell">
        <div className="hier-dialog-body">
          <p className="hier-dialog-desc">
            Pick a user story on the left, then add its test case categories and the test cases under each. Changes
            save to the QA checklist as you make them.
          </p>
          {selected ? (
            <div className="pqa-suite">
              <SuiteRail groups={groups} selectedId={selected.id} onSelect={setSelectedId} />
              <SuitePane key={selected.id} story={selected} vm={vm} onReload={onReload} />
            </div>
          ) : (
            <p className="pqa-note">There are no Feature user stories to write test cases for in this run.</p>
          )}
        </div>
        <div className="hier-dialog-footer">
          <div className="hier-dialog-actions pqa-suite__footer">
            <span className="pqa-suite__saved" role="status">
              {saving ? "Saving…" : "All changes saved"}
            </span>
            <button type="button" className="primary-button" disabled={saving} onClick={askDone}>
              Done
            </button>
          </div>
        </div>
        {confirming ? (
          <DoneConfirm unsaved={vm.form !== null} onCancel={() => setConfirming(false)} onConfirm={finish} />
        ) : null}
      </div>
    </Dialog>
  );
}
