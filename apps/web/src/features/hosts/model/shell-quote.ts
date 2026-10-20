/* Quote one value as a single literal word for the generated install scripts.
 * Values come from the server, but the scripts are pasted into a shell or
 * double-clicked, so every value is quoted rather than trusted. */

/** One bash word: single quotes, with an embedded quote closed and reopened. */
export const bashQuote = (value: string) =>
  "'" + value.replaceAll("'", "'\\''") + "'";

/** One PowerShell single-quoted string. PowerShell also treats the curly
 * single quotes as string delimiters, so those are doubled as well. */
export const psQuote = (value: string) =>
  "'" + value.replace(/['‘’‚‛]/g, "$&$&") + "'";
