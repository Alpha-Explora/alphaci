import { request } from "../../../../src/shared/api/request";

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

describe("request with a multipart body", () => {
  it("lets the browser set Content-Type (with its boundary) for FormData", async () => {
    fetchMock.mockResolvedValue(reply(201, JSON.stringify({ id: "att-1" })));
    const form = new FormData();
    form.append("source", "upload");
    await request("/upload", { method: "POST", body: form });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.credentials).toBe("include");
    expect(Object.keys(init.headers)).not.toContain("Content-Type");
  });

  it("still sends JSON's Content-Type for every other body", async () => {
    fetchMock.mockResolvedValue(reply(200, JSON.stringify({ ok: true })));
    await request("/json", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({ "Content-Type": "application/json" }));
    await request("/get");
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ "Content-Type": "application/json" }));
  });
});
