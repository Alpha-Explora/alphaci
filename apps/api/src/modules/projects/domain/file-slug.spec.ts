import { fileSlug } from './file-slug';

describe('fileSlug', () => {
  it('reduces a name to lowercase words joined by dashes', () => {
    expect(fileSlug('  My API Service!! ')).toBe('my-api-service');
    expect(fileSlug('--orders--api--')).toBe('orders--api');
    expect(fileSlug('***')).toBe('');
  });

  it('stays linear on a long run of dashes', () => {
    const hostile = `${'-'.repeat(100_000)}x${'-'.repeat(100_000)}`;
    const started = performance.now();
    expect(fileSlug(hostile)).toBe('x');
    expect(performance.now() - started).toBeLessThan(200);
  });
});
