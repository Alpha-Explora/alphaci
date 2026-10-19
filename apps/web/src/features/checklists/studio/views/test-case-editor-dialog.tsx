"use client";

import { useState } from "react";

import { Dialog } from "@/features/groups/workspace";

import type { ProjectQaRunItem } from "../../model/project-run-types";
import type { RunTestCasesViewModel } from "../view-models/use-run-test-cases-view-model";
import { RunTestCases } from "./run-test-cases";

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
  const editableStories = items.filter((item) => item.requirementKind === "functional" && vm.canManage(item));
  const [selectedId, setSelectedId] = useState("");
  const selected = editableStories.find((item) => item.id === selectedId) ?? editableStories[0] ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit test suite"
      description="Choose a user story, then add its test case categories and test cases. Changes save to the QA checklist as you make them."
      size="wide"
    >
      <div className="pqa-test-editor">
        <label className="hier-field">
          <span className="hier-field-label">Feature · user story</span>
          <select
            className="hier-select"
            value={selected?.id ?? ""}
            disabled={editableStories.length === 0}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {editableStories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.requirementName} · {item.title}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <RunTestCases item={selected} vm={vm} onReload={onReload} managementOnly />
        ) : (
          <p className="pqa-note">There are no user stories available for test case editing in this run.</p>
        )}
        <div className="pqa-test-editor__footer">
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
