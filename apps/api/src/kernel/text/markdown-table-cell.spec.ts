import { markdownTableCell } from './markdown-table-cell';

describe('markdownTableCell', () => {
  it('renders tags and entity references as text', () => {
    expect(markdownTableCell('<b>R&D</b> &lt;')).toBe(
      '&lt;b>R&amp;D&lt;/b> &amp;lt;',
    );
  });
  it('keeps a cell to one row and one column', () => {
    expect(markdownTableCell(' a | b\r\nc\nd ')).toBe('a \\| b<br>c<br>d');
  });

  it('escapes a backslash so it cannot escape the column separator', () => {
    // Rendered as `| C:\ |`, an unescaped trailing backslash turns the
    // closing pipe into a literal one and merges the next column.
    expect(markdownTableCell('C:\\')).toBe('C:\\\\');
    expect(markdownTableCell('a\\|b')).toBe('a\\\\\\|b');
  });
});
