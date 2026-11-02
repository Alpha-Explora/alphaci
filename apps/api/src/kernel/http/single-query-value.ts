/**
 * A query parameter as one string, or undefined.
 *
 * Express parses `?state=a&state=b` into an array and `?state[x]=1` into an
 * object, so a `@Query('state') state?: string` parameter is a type that lies.
 * Read the parameter as `unknown` and pass it through here at the controller,
 * so everything behind it really receives a string.
 */
export function singleQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
