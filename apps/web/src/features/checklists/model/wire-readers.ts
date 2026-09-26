/* Readers for untrusted wire values. Pure.
 *
 * Every field a backend adds is read through these, so an absent, null or
 * wrongly typed value becomes "not known" instead of a crash or a guess. */

export type Loose = Record<string, unknown>;

export function record(value: unknown): Loose | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Loose) : null;
}

export function oneOf<T extends string>(value: unknown, allowed: ReadonlyArray<T>): T | null {
  return typeof value === "string" && (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : null;
}

/** Trimmed, non-empty text; anything else is null. */
export function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** The strings of an array, trimmed and non-empty. Not an array: none. */
export function texts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((entry): entry is string => entry !== null);
}

/** A whole, positive number (a PR number, a row version); else null. */
export function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Only an absolute https URL is ever rendered as a link. */
export function httpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || !/^https:\/\//i.test(candidate)) return null;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

/** The records of an array; anything else in it is skipped. */
export function records(value: unknown): Loose[] {
  if (!Array.isArray(value)) return [];
  return value.map(record).filter((entry): entry is Loose => entry !== null);
}

/* ── Errors thrown by the API client ────────────────────────────────────── */

export function errorStatus(cause: unknown): number | null {
  const status = record(cause)?.status;
  return typeof status === "number" ? status : null;
}

export function errorDetails(cause: unknown): Loose | null {
  return record(record(cause)?.details);
}

/** `details.code`, or Nest's nested `details.error.code`, upper-cased. */
export function errorCode(cause: unknown): string {
  const details = errorDetails(cause);
  const code = details?.code ?? record(details?.error)?.code;
  return typeof code === "string" ? code.toUpperCase() : "";
}

/** The server's sentence. Nest sends validation messages as an array. */
export function errorMessage(cause: unknown): string | null {
  const message = errorDetails(cause)?.message;
  if (Array.isArray(message)) return text(texts(message).join(" "));
  return text(message);
}
