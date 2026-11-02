import { singleQueryValue } from './single-query-value';

describe('singleQueryValue', () => {
  it('passes one string through', () => {
    expect(singleQueryValue('abc')).toBe('abc');
    expect(singleQueryValue('')).toBe('');
  });

  it('drops what Express builds from repeated or nested parameters', () => {
    expect(singleQueryValue(['a', 'b'])).toBeUndefined();
    expect(singleQueryValue({ x: '1' })).toBeUndefined();
    expect(singleQueryValue(undefined)).toBeUndefined();
  });
});
