import { stripAnsi } from "@/shared/ui/strip-ansi";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe("stripAnsi", () => {
  it("removes the colour codes a stored Playwright message carries", () => {
    const stored = `${ESC}[2mexpect(${ESC}[22m${ESC}[31mreceived${ESC}[39m${ESC}[2m).toBeVisible()${ESC}[22m`;
    expect(stripAnsi(stored)).toBe("expect(received).toBeVisible()");
  });

  it("removes multi-parameter and cursor sequences", () => {
    expect(stripAnsi(`${ESC}[1;31mError${ESC}[0m: boom${ESC}[2K`)).toBe("Error: boom");
  });

  it("removes OSC hyperlinks, ended by BEL or by ESC backslash", () => {
    expect(stripAnsi(`${ESC}]8;;https://x.test${BEL}link${ESC}]8;;${BEL}`)).toBe("link");
    expect(stripAnsi(`${ESC}]0;title${ESC}\\after`)).toBe("after");
  });

  it("removes two-byte escapes", () => {
    expect(stripAnsi(`a${ESC}Mb`)).toBe("ab");
  });

  it("leaves plain text, brackets and newlines alone", () => {
    expect(stripAnsi("Expected [2] items\nGot [3]")).toBe("Expected [2] items\nGot [3]");
  });

  it("reads null and undefined as empty", () => {
    expect(stripAnsi(null)).toBe("");
    expect(stripAnsi(undefined)).toBe("");
    expect(stripAnsi("")).toBe("");
  });
});
