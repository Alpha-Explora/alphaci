import { parseUnifiedDiff } from "../../../../../../src/features/projects/detail/model/unified-diff";

describe("parseUnifiedDiff", () => {
  it("numbers context, deletions and additions on the side each belongs to", () => {
    const lines = parseUnifiedDiff(
      ["@@ -10,3 +10,3 @@ function login()", " keep", "-old", "+new", " tail"].join(
        "\n",
      ),
    );

    expect(lines).toEqual([
      { kind: "hunk", text: "function login()", oldNumber: null, newNumber: null },
      { kind: "context", text: "keep", oldNumber: 10, newNumber: 10 },
      { kind: "del", text: "old", oldNumber: 11, newNumber: null },
      { kind: "add", text: "new", oldNumber: null, newNumber: 11 },
      { kind: "context", text: "tail", oldNumber: 12, newNumber: 12 },
    ]);
  });

  it("restarts both counters at every hunk", () => {
    const lines = parseUnifiedDiff(
      ["@@ -1 +1 @@", "-a", "+b", "@@ -40,2 +41,2 @@", " x"].join("\n"),
    );
    expect(lines.at(-1)).toMatchObject({ oldNumber: 40, newNumber: 41 });
  });

  it("reads a hunk header with no counts, as GitHub writes for one-line ranges", () => {
    const [hunk, added] = parseUnifiedDiff("@@ -0,0 +1 @@\n+first");
    expect(hunk?.kind).toBe("hunk");
    expect(added).toMatchObject({ kind: "add", newNumber: 1 });
  });

  it("keeps the no-newline note without advancing either counter", () => {
    const lines = parseUnifiedDiff(
      ["@@ -1,1 +1,1 @@", "-a", "\\ No newline at end of file", "+b"].join("\n"),
    );
    expect(lines[2]).toEqual({
      kind: "note",
      text: "No newline at end of file",
      oldNumber: null,
      newNumber: null,
    });
    expect(lines[3]).toMatchObject({ kind: "add", newNumber: 1 });
  });

  it("does not render a trailing newline as an extra row", () => {
    expect(parseUnifiedDiff("@@ -1 +1 @@\n x\n")).toHaveLength(2);
  });

  it("keeps a line that is itself a marker character as text", () => {
    const [, line] = parseUnifiedDiff("@@ -1 +1 @@\n+-");
    expect(line).toMatchObject({ kind: "add", text: "-" });
  });
});
