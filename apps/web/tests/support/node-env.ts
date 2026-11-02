/** NODE_ENV is read-only in the Next.js types; tests still need to switch it. */
export function setNodeEnv(value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
  else Object.assign(process.env, { NODE_ENV: value });
}
