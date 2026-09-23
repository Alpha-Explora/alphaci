/* Wording for the add-member flow. The member list comes from the backend's
 * member directory (GitHub org, or the deployment's accounts), which explains
 * a failure in its own `message`, e.g. that the org could not be read and the
 * lead should sign in again. That explanation is the useful one, so it wins
 * over any generic text here. */

function errorStatus(cause: unknown): number | null {
  return typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    typeof cause.status === "number"
    ? cause.status
    : null;
}

/** The server's own `{ message }`, if the error carries one. */
export function serverErrorMessage(cause: unknown): string | null {
  if (typeof cause !== "object" || cause === null || !("details" in cause)) {
    return null;
  }
  const details = cause.details as { message?: unknown } | null | undefined;
  const message = details?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string");
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return typeof message === "string" && message.trim() ? message : null;
}

export function describeDirectoryError(cause: unknown): string {
  if (errorStatus(cause) === 403) {
    return "Only a group lead can add members.";
  }
  return (
    serverErrorMessage(cause) ??
    "The organization member list is unavailable. Please try again."
  );
}

/**
 * A 404 here is ambiguous: NestJS returns it both when the person is not in
 * the directory AND when the route does not exist (a backend on a stale
 * build). The server's message tells them apart, so it is preferred.
 */
export function describeAddMemberError(cause: unknown): string {
  const status = errorStatus(cause);
  if (status === 403) {
    return "You're not allowed to add members to this group.";
  }
  const message = serverErrorMessage(cause);
  if (message) return message;
  return status === null
    ? "The member could not be added. Please try again."
    : `The member could not be added (${String(status)}).`;
}

/** Shown when the directory answered but nobody matched. */
export function emptyDirectoryMessage(search: string): string {
  const term = search.trim();
  return term
    ? `No organization members match "${term}".`
    : "Everyone in the organization is already in this group.";
}
