"use client";

import { useLayoutEffect, useRef, useState } from "react";

import type { DeploymentLogLine } from "../model/deployment-logs-types";
import { countLinesAfter, logLevelTone } from "../model/log-buffer";
import {
  formatLogDateTime,
  formatLogTime,
  instanceTag,
  stripAnsi,
} from "../model/log-format";
import type { OlderPageState } from "../view-models/use-deployment-logs-view-model";

/** How close to the bottom still counts as "at the bottom", in px. */
const BOTTOM_SLACK = 12;

function LogLineRow({ line }: Readonly<{ line: DeploymentLogLine }>) {
  const tag = instanceTag(line.instance);
  return (
    <div
      className={`deploy-logs__line deploy-logs__line--${logLevelTone(line.level)}`}
      data-level={line.level}
    >
      {tag ? (
        <span className="deploy-logs__instance" title={line.instance ?? undefined}>
          [{tag}]
        </span>
      ) : null}
      <time
        className="deploy-logs__time"
        dateTime={line.timestamp}
        title={formatLogDateTime(line.timestamp)}
      >
        {formatLogTime(line.timestamp)}
      </time>
      <span className="deploy-logs__message">{stripAnsi(line.message)}</span>
    </div>
  );
}

function OlderButton({
  older,
  onLoadOlder,
}: Readonly<{ older: OlderPageState; onLoadOlder: () => void }>) {
  if (older === "none") return null;
  return (
    <div className="deploy-logs__older">
      <button
        className="deploy-logs__older-button"
        disabled={older === "loading"}
        onClick={onLoadOlder}
        type="button"
      >
        {older === "loading" ? "Loading older…" : "Load older"}
      </button>
    </div>
  );
}

function NewLinesPill({
  count,
  onJump,
}: Readonly<{ count: number; onJump: () => void }>) {
  if (count <= 0) return null;
  return (
    <button className="deploy-logs__pill" onClick={onJump} type="button">
      {count === 1 ? "1 new line" : `${count} new lines`}
    </button>
  );
}

/**
 * Lines, oldest at the top. Follows the newest line only while the reader is
 * at the bottom; scrolled up, it holds still and counts what arrived instead.
 * Loading older lines keeps the line the reader was on in place.
 */
export function LogLineList({
  lines,
  older,
  onLoadOlder,
  label,
}: Readonly<{
  lines: readonly DeploymentLogLine[];
  older: OlderPageState;
  onLoadOlder: () => void;
  label: string;
}>) {
  const scroller = useRef<HTMLDivElement>(null);
  const previous = useRef<{ firstId: string | null; height: number }>({
    firstId: null,
    height: 0,
  });
  const [pinned, setPinned] = useState(true);
  const [seenId, setSeenId] = useState<string | null>(null);
  const firstId = lines[0]?.id ?? null;
  const lastId = lines[lines.length - 1]?.id ?? null;

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const before = previous.current;
    if (pinned) {
      box.scrollTop = box.scrollHeight;
    } else if (before.firstId && before.firstId !== firstId) {
      // Lines landed above the reader: shift by what was added.
      box.scrollTop += box.scrollHeight - before.height;
    }
    previous.current = { firstId, height: box.scrollHeight };
  }, [firstId, lastId, pinned]);

  function onScroll() {
    const box = scroller.current;
    if (!box) return;
    const atBottom =
      box.scrollHeight - box.scrollTop - box.clientHeight <= BOTTOM_SLACK;
    if (atBottom === pinned) return;
    setPinned(atBottom);
    setSeenId(atBottom ? null : lastId);
  }

  function jumpToNewest() {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
    setPinned(true);
    setSeenId(null);
  }

  return (
    <div className="deploy-logs__frame">
      <div
        aria-label={label}
        aria-live="off"
        className="deploy-logs__scroller"
        onScroll={onScroll}
        ref={scroller}
        role="log"
        tabIndex={0}
      >
        <OlderButton older={older} onLoadOlder={onLoadOlder} />
        {lines.map((line) => (
          <LogLineRow key={line.id} line={line} />
        ))}
      </div>
      <NewLinesPill
        count={pinned ? 0 : countLinesAfter(lines, seenId)}
        onJump={jumpToNewest}
      />
    </div>
  );
}
