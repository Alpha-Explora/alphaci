/**
 * A query parameter as one string, or undefined.
 *
 * Express parses `?state=a&state=b` into an array and `?state[x]=1` into an
 * object, so a parameter typed `string` is a type that lies. Controllers get
 * this through `@QueryString('state')` (query-string.decorator.ts).
 */
export function singleQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
