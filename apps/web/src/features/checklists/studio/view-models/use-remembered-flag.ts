"use client";

import { useState } from "react";

/* Per-viewer preferences (e.g. "automation panel collapsed", "studio layout"),
 * kept in this browser's localStorage. Storage is a convenience, never a
 * dependency: a private window, blocked site data or a quota error just means
 * the preference starts at its fallback and is not remembered. */

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered this time; the choice still works for this visit.
  }
}

/**
 * One of a fixed set of string values, remembered per viewer. `resolve` turns
 * what storage holds (null when nothing does, or storage is unreadable) into a
 * value the caller allows, so an old or hand-edited entry falls back rather
 * than reaching the UI.
 */
export function useRememberedChoice<T extends string>(
  key: string,
  resolve: (stored: string | null) => T,
): [T, (next: T) => void] {
  const [value, setValue] = useState(() => resolve(readStored(key)));

  function choose(next: T) {
    setValue(next);
    writeStored(key, next);
  }

  return [value, choose];
}

type FlagValue = "1" | "0";

function flagOf(value: boolean): FlagValue {
  return value ? "1" : "0";
}

/** An on/off preference: a remembered choice between "1" and "0". */
export function useRememberedFlag(key: string, fallback: boolean): [boolean, () => void] {
  const [stored, choose] = useRememberedChoice<FlagValue>(key, (raw) =>
    raw === null ? flagOf(fallback) : flagOf(raw === "1"),
  );
  const value = stored === "1";
  return [value, () => choose(flagOf(!value))];
}

/** A plain disclosure (a badge's details, say): open or not, and a toggle. */
export function useDisclosure(initial = false): [boolean, () => void] {
  const [open, setOpen] = useState(initial);
  return [open, () => setOpen((value) => !value)];
}
