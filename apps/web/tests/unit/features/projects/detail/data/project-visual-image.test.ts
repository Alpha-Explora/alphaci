import { getVisualImageBlob } from "../../../../../../src/features/projects/detail/data/project-visual-api";
import { ApiError, getApiBaseUrl } from "../../../../../../src/shared/api/request";

/* The real transport with only fetch faked: the download must carry the
 * session cookie exactly as the <img> that shows the image does. */

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe("getVisualImageBlob", () => {
  it("reads the image with the session cookie and returns its bytes", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob });
    const url = `${getApiBaseUrl()}/projects/p1/workspace/visual/image?kind=diff&name=a.png`;

    await expect(getVisualImageBlob(url)).resolves.toBe(blob);

    const [requested, init] = fetchMock.mock.calls[0];
    expect(requested).toBe(url);
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("surfaces a refused image as an ApiError", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" });
    const failure = await getVisualImageBlob(`${getApiBaseUrl()}/projects/p1/workspace/visual/image`).catch(
      (cause: unknown) => cause,
    );
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(404);
  });

  it("never sends the session cookie to a URL outside the API", async () => {
    await expect(getVisualImageBlob("https://evil.example/projects/p1/image")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
