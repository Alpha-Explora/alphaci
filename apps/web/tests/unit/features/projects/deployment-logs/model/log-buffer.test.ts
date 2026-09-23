import {
  EMPTY_LOG_BUFFER,
  countLinesAfter,
  errorCount,
  logLevelTone,
  mergeLogPage,
  newestTimestamp,
  olderPageCursor,
  type LogBuffer,
} from "../../../../../../src/features/projects/deployment-logs/model/log-buffer";
import { line } from "../log-fixtures";

function ids(buffer: LogBuffer): string[] {
  return buffer.lines.map((entry) => entry.id);
}

describe("mergeLogPage", () => {
  it("keeps lines oldest to newest across pages merged at either end", () => {
    let buffer = mergeLogPage(EMPTY_LOG_BUFFER, [line("c", 3), line("d", 4)], "newer");
    buffer = mergeLogPage(buffer, [line("e", 5)], "newer");
    buffer = mergeLogPage(buffer, [line("a", 1), line("b", 2)], "older");

    expect(ids(buffer)).toEqual(["a", "b", "c", "d", "e"]);
    expect(buffer.atLive).toBe(true);
  });

  it("dedupes by id, keeping the copy already held", () => {
    const held = mergeLogPage(EMPTY_LOG_BUFFER, [line("a", 1), line("b", 2)], "newer");
    const merged = mergeLogPage(
      held,
      [line("b", 2, { message: "resent" }), line("c", 3)],
      "newer",
    );

    expect(ids(merged)).toEqual(["a", "b", "c"]);
    expect(merged.lines[1]?.message).toBe("message b");
  });

  it("returns the same buffer when a page adds nothing new", () => {
    const held = mergeLogPage(EMPTY_LOG_BUFFER, [line("a", 1)], "newer");
    expect(mergeLogPage(held, [line("a", 1)], "newer")).toBe(held);
  });

  it("keeps the provider's order among lines that share a timestamp", () => {
    const buffer = mergeLogPage(
      EMPTY_LOG_BUFFER,
      [line("x", 1), line("y", 1), line("z", 1)],
      "newer",
    );
    expect(ids(buffer)).toEqual(["x", "y", "z"]);
  });

  it("places a gap-filling page between what it sits between", () => {
    let buffer = mergeLogPage(EMPTY_LOG_BUFFER, [line("a", 1)], "newer");
    buffer = mergeLogPage(buffer, [line("d", 9)], "newer");
    buffer = mergeLogPage(buffer, [line("b", 4), line("c", 6)], "newer");
    expect(ids(buffer)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops the oldest when newer lines push it over the cap", () => {
    const held = mergeLogPage(EMPTY_LOG_BUFFER, [line("a", 1), line("b", 2), line("c", 3)], "newer", 3);
    const merged = mergeLogPage(held, [line("d", 4)], "newer", 3);

    expect(ids(merged)).toEqual(["b", "c", "d"]);
    expect(merged.atLive).toBe(true);
    expect(merged.trimmedOldest).toBe(true);
  });

  it("drops the newest, and leaves live, when older lines push it over the cap", () => {
    const held = mergeLogPage(EMPTY_LOG_BUFFER, [line("c", 3), line("d", 4), line("e", 5)], "newer", 3);
    const merged = mergeLogPage(held, [line("a", 1), line("b", 2)], "older", 3);

    expect(ids(merged)).toEqual(["a", "b", "c"]);
    expect(merged.atLive).toBe(false);
  });

  it("defaults to a 2000-line cap", () => {
    const many = Array.from({ length: 2001 }, (_, i) =>
      line(`l${i}`, 0, { timestamp: new Date(Date.UTC(2026, 8, 24, 10) + i).toISOString() }),
    );
    const buffer = mergeLogPage(EMPTY_LOG_BUFFER, many, "newer");
    expect(buffer.lines).toHaveLength(2000);
    expect(buffer.lines[0]?.id).toBe("l1");
  });
});

describe("olderPageCursor", () => {
  const window = { startTime: "2026-09-24T09:00:00.000Z", endTime: null };
  const next = { startTime: "2026-09-24T09:00:00.000Z", endTime: "2026-09-24T10:00:00.000Z" };

  it("uses the provider's cursor while the oldest page is still held", () => {
    const buffer = mergeLogPage(EMPTY_LOG_BUFFER, [line("a", 1)], "newer");
    expect(olderPageCursor(buffer, next, window)).toBe(next);
  });

  it("pages from the oldest line kept once the oldest page was trimmed", () => {
    const buffer = mergeLogPage(
      mergeLogPage(EMPTY_LOG_BUFFER, [line("a", 1), line("b", 2)], "newer", 2),
      [line("c", 3)],
      "newer",
      2,
    );
    expect(olderPageCursor(buffer, next, window)).toEqual({
      startTime: window.startTime,
      endTime: line("b", 2).timestamp,
    });
  });
});

describe("log buffer reads", () => {
  it("counts errors and reads the newest timestamp", () => {
    const lines = [line("a", 1, { level: "error" }), line("b", 2, { level: "warn" }), line("c", 3, { level: "error" })];
    expect(errorCount(lines)).toBe(2);
    expect(newestTimestamp({ ...EMPTY_LOG_BUFFER, lines })).toBe(line("c", 3).timestamp);
    expect(newestTimestamp(EMPTY_LOG_BUFFER)).toBeNull();
  });

  it("counts the lines after the one last seen, by id", () => {
    const lines = [line("a", 1), line("b", 2), line("c", 3), line("d", 4)];
    expect(countLinesAfter(lines, "b")).toBe(2);
    expect(countLinesAfter(lines, "d")).toBe(0);
    expect(countLinesAfter(lines, null)).toBe(0);
    // The seen line rolled out of the buffer: everything held is new.
    expect(countLinesAfter(lines, "gone")).toBe(4);
  });

  it("maps levels to the provider's tones", () => {
    expect(logLevelTone("error")).toBe("danger");
    expect(logLevelTone("warn")).toBe("warning");
    expect(logLevelTone("info")).toBe("default");
    expect(logLevelTone("debug")).toBe("muted");
  });
});
