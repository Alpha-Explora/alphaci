import { playwrightLiveRepository } from "../../../../../src/features/checklists/data/playwright-live-repository";
import { ApiError } from "../../../../../src/shared/api/request";
import { liveRun } from "../playwright-live-fixtures";

/* The real transport (only fetch is faked): the URL, the session cookie, the
 * normaliser, and a 404 from an older backend passed on as an ApiError. */

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function reply(status: number, body?: unknown) {
  const textBody = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (textBody ? JSON.parse(textBody) : Promise.reject(new SyntaxError("empty"))),
    text: async () => textBody,
  };
}

describe("playwrightLiveRepository.getPlaywrightLive", () => {
  it("GETs the repository's live route for the branch, with the session cookie, and normalises the run", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { run: liveRun() }));
    const run = await playwrightLiveRepository.getPlaywrightLive("proj/fe", "uat");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/v1/projects/proj%2Ffe/workspace/playwright-live?branch=uat");
    expect(init).toMatchObject({ credentials: "include" });
    expect(run).toMatchObject({ runId: 123, status: "running", done: 4, total: 12 });
  });

  it("answers null when there is no run, or the body is not the expected shape", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { run: null }));
    await expect(playwrightLiveRepository.getPlaywrightLive("p1", "uat")).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(reply(200, ["nope"]));
    await expect(playwrightLiveRepository.getPlaywrightLive("p1", "uat")).resolves.toBeNull();
  });

  it("passes a 404 (a backend without the route) on as an ApiError", async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { message: "Cannot GET" }));
    await expect(playwrightLiveRepository.getPlaywrightLive("p1", "uat")).rejects.toMatchObject({ status: 404 });
    fetchMock.mockResolvedValueOnce(reply(404, { message: "Cannot GET" }));
    await expect(playwrightLiveRepository.getPlaywrightLive("p1", "uat")).rejects.toBeInstanceOf(ApiError);
  });
});
