import { UnauthorizedException } from '@nestjs/common';

import { extractBearerToken } from './ci-bearer';

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc123', 'abc123'],
    ['bearer abc123', 'abc123'],
    ['BEARER\tabc123  ', 'abc123'],
    ['Bearer   abc123\n', 'abc123'],
  ])('reads %j as %s', (header, token) => {
    expect(extractBearerToken(header)).toBe(token);
  });

  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Bearerabc123',
    'Basic abc123',
    'Bearer a\nb',
  ])('refuses %j with 401', (header) => {
    expect(() => extractBearerToken(header)).toThrow(UnauthorizedException);
  });

  it('stays linear on a header built to make a regex backtrack', () => {
    // /^Bearer\s+(.+)$/i took 809 ms on 20,000 spaces and two newlines,
    // growing with the square of the length: one request could stall the API.
    const header = `Bearer ${' '.repeat(100_000)}\n\n`;
    const started = performance.now();
    expect(() => extractBearerToken(header)).toThrow(UnauthorizedException);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
