const fallbackMessages: Record<number, string> = {
  0: "Unable to connect to AlphaCI. Check your connection and try again.",
  400: "Some information is missing or invalid. Check your entries and try again.",
  401: "Your session has expired. Sign in again to continue.",
  402: "Your plan's limit has been reached. Review your plan or contact your administrator.",
  403: "You do not have permission to do this. Ask your administrator for access.",
  404: "This item could not be found. It may have been moved or deleted.",
  408: "The request took too long. Check your connection and try again.",
  409: "This item has changed or already exists. Refresh the page and try again.",
  410: "This item is no longer available. Refresh the page to continue.",
  413: "The upload is too large. Choose a smaller file and try again.",
  415: "This file format is not supported. Choose a supported format and try again.",
  422: "Some information is invalid. Check your entries and try again.",
  429: "Too many requests. Wait a moment, then try again.",
  500: "Something went wrong in AlphaCI. Try again in a moment. If it keeps happening, contact your administrator.",
  502: "AlphaCI could not reach a required service. Try again in a moment.",
  503: "This service is temporarily unavailable. Try again in a moment. If it keeps happening, contact your administrator.",
  504: "A required service took too long to respond. Try again in a moment.",
};

function usesGenericMessage(status: number): boolean {
  return (status >= 500 && status !== 503) || status === 401 || status === 429;
}

function structuredMessage(details: unknown): string {
  if (!details || typeof details !== "object" || !("message" in details)) return "";
  const value = details.message;
  return (Array.isArray(value)
    ? value.filter((part): part is string => typeof part === "string").join(" ")
    : typeof value === "string" ? value : "").trim();
}

/** Only structured, readable API messages belong in an error banner. */
export function serverErrorMessage(status: number, details: unknown): string | undefined {
  if (usesGenericMessage(status)) return;
  const message = structuredMessage(details);
  if (!message || message.length > 1200) return;
  if (/^(?:bad request|unauthorized|forbidden|not found|conflict|service unavailable|internal server error|request failed with status \d+)[.!]?$/i.test(message)) return;
  // Keep diagnostic payloads in ApiError.details, away from user-facing copy.
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]|\n\s*at\s|\b(?:TypeError|ReferenceError|SyntaxError|SQLSTATE|ECONNREFUSED|ENOTFOUND)\b|\b(?:select\s+.+\s+from|insert\s+into|update\s+.+\s+set)\b|(?:password|secret|authorization|access_token|api[_-]?key)\s*[:=]|^\s*[\[{]/i.test(message)) return;
  return message;
}

export function apiErrorMessage(status: number, details?: unknown): string {
  return serverErrorMessage(status, details) ?? fallbackMessages[status] ??
    "The request could not be completed. Try again. If it keeps happening, contact your administrator.";
}
