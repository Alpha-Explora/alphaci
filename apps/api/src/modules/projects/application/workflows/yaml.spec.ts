import { dumpYaml, loadYaml } from './yaml';

// Each case is what js-yaml 4 produced, which generated workflows and the
// golden snapshots depend on. js-yaml 5's defaults differ on every one.
describe('loadYaml', () => {
  it('reads blank input as undefined and content-free input as null', () => {
    expect(loadYaml('')).toBeUndefined();
    expect(loadYaml('  \n')).toBeUndefined();
    expect(loadYaml('# only a comment\n')).toBeNull();
    expect(loadYaml('\n\n')).toBeNull();
  });

  it('refuses more than one document', () => {
    expect(() => loadYaml('a: 1\n---\nb: 2\n')).toThrow(
      'expected a single document in the stream, but found more',
    );
  });

  it('keeps `on` a string key and merges `<<` keys', () => {
    expect(
      loadYaml('on: push\nbase: &b {a: 1, b: 2}\nx:\n  <<: *b\n  b: 3\n'),
    ).toEqual({ on: 'push', base: { a: 1, b: 2 }, x: { a: 1, b: 3 } });
  });

  it('reads dates as Date, rolling over out-of-range days', () => {
    expect(loadYaml('a: 2026-10-19\nb: 2026-02-30\n')).toEqual({
      a: new Date(Date.UTC(2026, 9, 19)),
      b: new Date(Date.UTC(2026, 2, 2)),
    });
  });

  it('reads numbers the way js-yaml 4 did', () => {
    expect(
      loadYaml('a: -0\nb: -0x1F\nc: 0b101\nd: -.5\ne: 1_000\nf: 1e3\n'),
    ).toEqual({ a: 0, b: -31, c: 5, d: '-.5', e: '1_000', f: 1000 });
    expect(Object.is((loadYaml('a: -0\n') as { a: number }).a, 0)).toBe(true);
  });

  it('reads !!set as an object of nulls and complex keys as strings', () => {
    expect(loadYaml('s: !!set {a, b}\n? [x, y]\n: 1\n')).toEqual({
      s: { a: null, b: null },
      'x,y': 1,
    });
  });
});

describe('dumpYaml', () => {
  it('quotes strings js-yaml 4 quoted', () => {
    expect(
      dumpYaml({
        on: { push: null },
        flag: '-e',
        port: '443:443',
        empty: '',
        yes: 'yes',
        version: '1.0',
        expr: '${{ github.sha }}',
      }),
    ).toBe(
      [
        "'on':",
        '  push: null',
        "flag: '-e'",
        "port: '443:443'",
        "empty: ''",
        "'yes': 'yes'",
        "version: '1.0'",
        'expr: ${{ github.sha }}',
        '',
      ].join('\n'),
    );
  });

  it('writes long lines unbroken and repeats shared objects', () => {
    const shared = { run: `echo ${'x '.repeat(60)}end` };
    expect(dumpYaml({ a: shared, b: shared })).toBe(
      `a:\n  run: ${shared.run}\nb:\n  run: ${shared.run}\n`,
    );
  });

  it('ends a trailing kept block scalar without a document end marker', () => {
    expect(dumpYaml({ run: 'echo hi\n\n' })).toBe('run: |+\n  echo hi\n\n');
  });
});
