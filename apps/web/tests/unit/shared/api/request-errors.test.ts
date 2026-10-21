import { ApiError, request, requestBlob, requestText } from "@/shared/api/request";

const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; });
afterEach(() => { fetchMock.mockReset(); });

function reply(status: number, details: unknown, reference?: string) {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    text: async () => typeof details === "string" ? details : JSON.stringify(details),
    headers: { get: () => reference ?? null },
  });
}

it("preserves the actionable Hosts reason and support reference", async () => {
  const details = { message: "Configure the public HTTPS API address first.", correlationId: "ref-123" };
  reply(503, details);
  await expect(request("/hosts")).rejects.toMatchObject({
    name: "ApiError", status: 503, message: details.message, details, correlationId: "ref-123",
  });
});

it("keeps all validation messages and specific permission reasons", async () => {
  reply(400, { message: ["Machine name is required.", "Choose an operating system."] });
  await expect(request("/hosts")).rejects.toThrow("Machine name is required. Choose an operating system.");
  reply(403, { message: "Only workspace owners can manage hosts." });
  await expect(request("/hosts")).rejects.toThrow("Only workspace owners can manage hosts.");
});

it.each([
  [401, "Sign in again"], [403, "permission"], [404, "could not be found"],
  [409, "Refresh the page"], [413, "smaller file"], [429, "Wait a moment"],
  [500, "contact your administrator"], [502, "required service"],
  [503, "temporarily unavailable"], [504, "too long"], [418, "could not be completed"],
])("gives a readable fallback for HTTP %s", async (status, message) => {
  reply(status, undefined);
  await expect(request("/x")).rejects.toThrow(message);
});

it.each([
  [502, "<html>upstream failure</html>"],
  [400, { message: "TypeError: Cannot read properties of undefined\n at handler (app.js:3)" }],
  [503, { message: "SELECT token FROM sessions" }],
  [400, { message: "api_key=private-value" }],
  [500, { message: "private internal failure" }],
])("keeps technical response details out of banners (%s)", async (status, details) => {
  reply(status, details);
  const error = await request("/x").catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).details).toEqual(details);
  expect((error as ApiError).message).not.toMatch(/html|TypeError|SELECT|private/);
});

it("handles network failures consistently for JSON, text and downloads", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  for (const send of [request, requestText, requestBlob]) {
    await expect(send("/x")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Check your connection") });
  }
});

it("preserves cancellation instead of reporting a network error", async () => {
  const abort = new DOMException("Aborted", "AbortError");
  fetchMock.mockRejectedValue(abort);
  await expect(request("/x")).rejects.toBe(abort);
});

it("handles unreadable error bodies and takes the reference from the header", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => { throw new Error("broken stream"); }, headers: { get: () => "request-456" } });
  await expect(request("/x")).rejects.toMatchObject({ status: 503, correlationId: "request-456", message: expect.stringContaining("temporarily unavailable") });
});
