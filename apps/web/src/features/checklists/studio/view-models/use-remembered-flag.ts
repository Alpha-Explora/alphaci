"use client";

import { useState } from "react";

/* A per-viewer on/off preference (e.g. "automation panel collapsed"), kept in
 * this browser's localStorage. Storage is a convenience, never a dependency:
 * a private window, blocked site data or a quota error just means the flag
 * starts at its fallback and is not remembered. */

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Not remembered this time; the flag still works for this visit.
  }
}

export function useRememberedFlag(key: string, fallback: boolean): [boolean, () => void] {
  const [value, setValue] = useState(() => readFlag(key, fallback));

  function toggle() {
    const next = !value;
    setValue(next);
    writeFlag(key, next);
  }

  return [value, toggle];
}

/** A plain disclosure (a badge's details, say): open or not, and a toggle. */
export function useDisclosure(initial = false): [boolean, () => void] {
  const [open, setOpen] = useState(initial);
  return [open, () => setOpen((value) => !value)];
}
