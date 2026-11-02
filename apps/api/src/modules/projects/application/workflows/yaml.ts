import {
  CORE_SCHEMA,
  NOT_RESOLVED,
  SCALAR_STYLE,
  YAMLException,
  binaryTag,
  dump,
  floatCoreTag,
  intCoreTag,
  legacyMapTag,
  loadAll,
  mergeTag,
  omapTag,
  pairsTag,
  strTag,
  timestampTag,
  type ScalarLayout,
  type ScalarStyle,
} from 'js-yaml';

// The API's YAML (generated workflows, catalog templates, customer workflow
// files) was read and written with js-yaml 4. js-yaml 5 changed what YAML
// loads to and how strings are quoted, so all YAML goes through this file,
// which gives js-yaml 4's results. Each override below names the js-yaml 4
// behaviour it keeps.

const isNumber = (data: unknown): data is number =>
  Object.prototype.toString.call(data) === '[object Number]';

// js-yaml 4 read `-0` as 0 and accepted a sign on 0x, 0o and 0b integers.
const intTag = {
  ...intCoreTag,
  resolve: (source: string, _isExplicit: boolean, tagName: string) =>
    source === '-0' ? 0 : intCoreTag.resolve(source, true, tagName),
  identify: (data: unknown) =>
    isNumber(data) && data % 1 === 0 && !Object.is(data, -0),
};

// js-yaml 4 read `-.5` and `+.5` as strings.
const JS_YAML_4_FLOAT =
  /^(?:[-+]?[0-9]+(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const floatTag = {
  ...floatCoreTag,
  resolve: (source: string, isExplicit: boolean, tagName: string) =>
    JS_YAML_4_FLOAT.test(source)
      ? floatCoreTag.resolve(source, isExplicit, tagName)
      : NOT_RESOLVED,
  identify: (data: unknown) =>
    isNumber(data) && (data % 1 !== 0 || Object.is(data, -0)),
};

// js-yaml 4 read any date-shaped scalar without range checks, letting
// Date.UTC roll over (2026-02-30 is 2 March) and map years 0-99 to 1900-1999.
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const TIMESTAMP =
  /^([0-9]{4})-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \t]+)([0-9][0-9]?):([0-9]{2}):([0-9]{2})(?:\.([0-9]*))?(?:[ \t]*(Z|([-+])([0-9][0-9]?)(?::([0-9]{2}))?))?$/;
const dateTag = {
  ...timestampTag,
  resolve: (source: string) => {
    const match = DATE.exec(source) ?? TIMESTAMP.exec(source);
    if (match === null) return NOT_RESOLVED;
    const part = (index: number) => Number(match[index] ?? 0);
    if (match[4] === undefined) {
      return new Date(Date.UTC(part(1), part(2) - 1, part(3)));
    }
    const milliseconds = Number((match[7] ?? '').slice(0, 3).padEnd(3, '0'));
    const date = new Date(
      Date.UTC(
        part(1),
        part(2) - 1,
        part(3),
        part(4),
        part(5),
        part(6),
        milliseconds,
      ),
    );
    if (match[9] !== undefined) {
      const offset = (part(10) * 60 + part(11)) * 60_000;
      date.setTime(date.getTime() - (match[9] === '-' ? -offset : offset));
    }
    return date;
  },
};

// js-yaml 4 read `!!set` as an object whose values are all null.
const setTag = {
  ...legacyMapTag,
  tagName: 'tag:yaml.org,2002:set',
  identify: () => false,
  addPair: (
    container: Record<string, unknown>,
    key: unknown,
    value: unknown,
  ) =>
    value === null
      ? legacyMapTag.addPair(container, key, value)
      : 'cannot resolve a set item',
};

// js-yaml 4 turned complex keys into strings and wrote any object, including
// class instances, as a mapping.
const mapTag = {
  ...legacyMapTag,
  identify: (data: unknown) =>
    Object.prototype.toString.call(data) === '[object Object]',
};

const SCHEMA = CORE_SCHEMA.withTags(
  intTag,
  floatTag,
  dateTag,
  mergeTag,
  binaryTag,
  omapTag,
  pairsTag,
  setTag,
  mapTag,
);

// js-yaml 4 found no document at all in empty input, or in spaces followed by
// at most one line break.
const NO_DOCUMENT = /^\uFEFF? *[\n\r]?$/;

/**
 * Parses one YAML document. Empty input gives `undefined`, input with no
 * content (comments or blank lines) gives `null`, and more than one document
 * throws.
 */
export function loadYaml(source: string): unknown {
  if (NO_DOCUMENT.test(source)) return undefined;
  const documents = loadAll(source, { schema: SCHEMA });
  if (documents.length > 1) {
    throw new YAMLException(
      'expected a single document in the stream, but found more',
    );
  }
  return documents.length === 0 ? null : documents[0];
}

/**
 * Writes YAML the way js-yaml 4 did with `lineWidth: -1, noRefs: true`:
 * no folding, and shared objects repeated instead of anchored.
 */
export function dumpYaml(value: unknown): string {
  const text = dump(value, {
    schema: SCHEMA,
    lineWidth: -1,
    noRefs: true,
    scalarStyleRules: [jsYaml4StringStyle],
  });
  // js-yaml 5 closes the document with `...` when it ends in a block scalar
  // that keeps trailing blank lines (`|+`). js-yaml 4 did not. Every other
  // line of such a document is indented, so this suffix is always the marker.
  return text.endsWith('\n...\n') ? text.slice(0, -'...\n'.length) : text;
}

// js-yaml 4's string style choice (chooseScalarStyle and writeScalar in its
// dumper.js) for an unlimited line width, single quotes and no forced quotes.
// Other scalars (numbers, booleans, null, dates) keep their plain style.
const YAML_1_1_LOOKALIKES = new Set(
  'y Y yes Yes YES on On ON n N no No NO off Off OFF'.split(' '),
);
const BASE_60 = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
const NOT_PLAIN_FIRST = new Set('-?:,[]{}#&*!|=>\'"%@`');
const FLOW_INDICATORS = new Set(',[]{}');
const LINE_FEED = 0x0a;
const SPACE = 0x20;
const TAB = 0x09;
const COLON = 0x3a;
const SHARP = 0x23;

function jsYaml4StringStyle(layout: ScalarLayout): void {
  if (layout.node.tag !== strTag.tagName) return;
  layout.style = chooseStringStyle(
    layout.node.value,
    layout.isKey || layout.flowOnly,
    !layout.flowOnly,
    (value) =>
      layout.presenterOptions.schema.resolveImplicitScalarTag(value).tag
        .tagName !== strTag.tagName,
  );
}

function chooseStringStyle(
  value: string,
  singleLineOnly: boolean,
  inBlock: boolean,
  readsAsAnotherType: (value: string) => boolean,
): ScalarStyle {
  if (value === '' || YAML_1_1_LOOKALIKES.has(value) || BASE_60.test(value)) {
    return SCALAR_STYLE.SINGLE_QUOTED;
  }
  const first = value.codePointAt(0) ?? 0;
  const last = value.codePointAt(value.length - 1) ?? 0;
  let plain =
    isPrintable(first) &&
    !isWhitespace(first) &&
    !NOT_PLAIN_FIRST.has(String.fromCodePoint(first)) &&
    !isWhitespace(last) &&
    last !== COLON;
  let hasLineBreak = false;
  let previous: number | null = null;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code === LINE_FEED && !singleLineOnly) hasLineBreak = true;
    else if (!isPrintable(code)) return SCALAR_STYLE.DOUBLE_QUOTED;
    plain = plain && isPlainSafe(code, character, previous, inBlock);
    previous = code;
  }
  if (hasLineBreak) return SCALAR_STYLE.LITERAL_BLOCK;
  return plain && !readsAsAnotherType(value)
    ? SCALAR_STYLE.PLAIN
    : SCALAR_STYLE.SINGLE_QUOTED;
}

function isPrintable(code: number): boolean {
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa1 && code <= 0xd7ff && code !== 0x2028 && code !== 0x2029) ||
    (code >= 0xe000 && code <= 0xfffd && code !== 0xfeff) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function isWhitespace(code: number): boolean {
  return code === SPACE || code === TAB;
}

function isPlainSafe(
  code: number,
  character: string,
  previous: number | null,
  inBlock: boolean,
): boolean {
  const printable = isPrintable(code);
  const nsChar = printable && !isWhitespace(code);
  const previousIsNsChar =
    previous !== null && isPrintable(previous) && !isWhitespace(previous);
  return (
    ((inBlock ? printable : printable && !FLOW_INDICATORS.has(character)) &&
      code !== SHARP &&
      !(previous === COLON && !nsChar)) ||
    (previousIsNsChar && code === SHARP) ||
    (previous === COLON && nsChar)
  );
}
