/* Terminal escape sequences out of text shown in the page.
 *
 * Stored CI output (Playwright failure messages above all) keeps the colour
 * codes the runner printed, e.g. "\u001b[2mexpect(\u001b[22m". A browser prints
 * them as stray "[2m" fragments. Pure: no React, no DOM. */

// CSI sequences (ESC [ params final-byte), OSC sequences (ESC ] ... BEL/ST),
// and any other two-byte ESC sequence. Built from a string so the source holds
// no literal control characters.
const ESC = "\\u001b";
const CSI = `${ESC}\\[[0-?]*[ -/]*[@-~]`;
const OSC = `${ESC}\\][^\\u0007\\u001b]*(?:\\u0007|${ESC}\\\\)`;
const OTHER = `${ESC}[@-Z\\\\-_]`;
const ANSI_PATTERN = new RegExp(`${CSI}|${OSC}|${OTHER}`, "g");

/** The text without terminal escape sequences. Null and undefined read as "". */
export function stripAnsi(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(ANSI_PATTERN, "");
}
