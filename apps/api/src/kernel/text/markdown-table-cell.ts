/**
 * Free text made safe for one Markdown table cell: backslashes escaped first
 * (a trailing `\` would otherwise escape the column's `|`), line breaks as
 * `<br>` (a bare newline ends the row), pipes as `\|` (a bare pipe adds a
 * column), then trimmed.
 */
export function markdownTableCell(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}
