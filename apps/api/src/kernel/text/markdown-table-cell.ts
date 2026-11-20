/** Prevents user-provided Markdown text from opening an HTML tag or entity. */
export function escapeMarkdownHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
}

/** Escapes Markdown table delimiters and preserves line breaks. */
export function markdownTableCell(value: string): string {
  return escapeMarkdownHtml(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}
