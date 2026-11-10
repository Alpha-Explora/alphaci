'use client';
import { useRef, useState } from 'react';
import { qaImportRepository } from '../../data/qa-import-repository';
import {
  importFileProblem,
  initialMapping,
  previewImport,
} from '../../model/qa-import-rules';
import type {
  ImportMapping,
  ImportMode,
  ImportSheet,
  ImportStory,
} from '../../model/qa-import-types';

export function useQaImportViewModel(
  projectId: string,
  mode: ImportMode,
  stories: ImportStory[],
  onImported: () => void,
) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ImportMapping>({
    group: -1,
    title: -1,
    details: -1,
  });
  const [carryGroup, setCarryGroup] = useState(false);
  const [storyId, setStoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const preview = previewImport(sheets[sheetIndex], mapping, mode, carryGroup);
  const story = storyId
    ? stories.find((entry) => entry.itemId === storyId)
    : stories[0];

  async function upload(file: File) {
    if (busyRef.current) return;
    setSheets([]);
    setFileName(file.name);
    setError(null);
    setSuccess(null);
    const problem = importFileProblem(file, mode);
    if (problem) {
      setError(problem);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await qaImportRepository.preview(projectId, file);
      setSheets(next);
      setSheetIndex(0);
      if (next[0]) setMapping(initialMapping(next[0], mode));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The file could not be read.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (
      busyRef.current ||
      !preview.rows.length ||
      preview.errors.length ||
      (mode === 'test-cases' && !story)
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const message =
        mode === 'requirements'
          ? await qaImportRepository.requirements(projectId, preview.rows)
          : await qaImportRepository.testCases(story!, preview.rows);
      setSuccess(message);
      setSheets([]);
      onImported();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The import could not be confirmed. Reload before retrying.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return {
    open,
    show: () => {
      setSuccess(null);
      setFileName('');
      setError(null);
      setSheets([]);
      setOpen(true);
    },
    close: () => {
      if (!busyRef.current) setOpen(false);
    },
    fileName,
    sheets,
    sheetIndex,
    mapping,
    setMapping,
    carryGroup,
    setCarryGroup,
    story,
    setStoryId,
    chooseSheet: (index: number) => {
      const next = sheets[index];
      if (next) {
        setSheetIndex(index);
        setMapping(initialMapping(next, mode));
      }
    },
    busy,
    error,
    success,
    preview,
    upload,
    save,
    canSave:
      !busy &&
      preview.rows.length > 0 &&
      preview.errors.length === 0 &&
      (mode === 'requirements' || Boolean(story)),
  };
}
