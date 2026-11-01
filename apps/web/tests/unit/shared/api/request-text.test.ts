import { ApiError, request, requestText } from "../../../../src/shared/api/request";

function reply(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(body),
    json: jest.fn().mockImplementation(async () => JSON.parse(body)),
  } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  global.fetch = fetchMock;
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("requestText", () => {
  it("returns the body as text, with the session cookie and caller headers", async () => {
    fetchMock.mockResolvedValue(reply(200, "# QA Report\n\n| # | Item |"));
    const text = await requestText("/projects/p1/qa-runs/r1/report?format=md", {
      headers: { Accept: "text/markdown" },
    });
    expect(text).toBe("# QA Report\n\n| # | Item |");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/projects\/p1\/qa-runs\/r1\/report\?format=md$/);
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual(expect.objectContaining({ Accept: "text/markdown" }));
  });

  it("throws the same ApiError as request on a non-2xx reply", async () => {
    fetchMock.mockResolvedValue(reply(404, JSON.stringify({ message: "Not found" })));
    await expect(requestText("/x")).rejects.toEqual(
      expect.objectContaining({ name: "ApiError", status: 404, details: { message: "Not found" } }),
    );
    fetchMock.mockResolvedValue(reply(400, "bad format"));
    await expect(requestText("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("returns an empty string for 204", async () => {
    fetchMock.mockResolvedValue(reply(204, ""));
    await expect(requestText("/x")).resolves.toBe("");
  });

  it("leaves request's JSON behaviour unchanged", async () => {
    fetchMock.mockResolvedValue(reply(200, JSON.stringify({ ok: true })));
    await expect(request<{ ok: boolean }>("/x")).resolves.toEqual({ ok: true });
    fetchMock.mockResolvedValue(reply(200, ""));
    await expect(request("/x")).resolves.toBeUndefined();
  });
});
