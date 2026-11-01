"use client";

import type { ReactNode } from "react";

import { itemStatusTone } from "../../model/qa-run-rules";
import type { QaRunItemStatus } from "../../model/qa-run-types";
import { BlockedIcon, CheckIcon, CrossIcon, ReturnIcon } from "./studio-icons";

const STATUS_GLYPHS: Partial<Record<QaRunItemStatus, () => ReactNode>> = {
  passed: CheckIcon,
  failed: CrossIcon,
  blocked: BlockedIcon,
  returned_to_dev: ReturnIcon,
};

/**
 * The item's number slot, tinted by its status: a tick once passed, a cross
 * once failed, the number while it is still to do. The slot the read-only
 * checklist reserved for exactly this. Decorative — the status pill beside the
 * title carries the words.
 */
export function StatusMarker({
  status,
  index,
}: Readonly<{ status: QaRunItemStatus; index: number }>) {
  const Glyph = STATUS_GLYPHS[status];
  return (
    <span className={`qa-marker qa-marker--${itemStatusTone(status)}`} aria-hidden="true">
      {Glyph ? <Glyph /> : String(index + 1).padStart(2, "0")}
    </span>
  );
}
