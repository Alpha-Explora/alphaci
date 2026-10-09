import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { getProjectVisualChecks } from "../../../../../../src/features/projects/detail/data/project-visual-api";
import { EVIDENCE_IMAGE_WAIT_MS } from "../../../../../../src/features/projects/detail/model/visual-evidence-rules";
import { VisualEvidence } from "../../../../../../src/features/projects/detail/views/visual-evidence";
import { ApiError, getApiBaseUrl } from "../../../../../../src/shared/api/request";
import { EVIDENCE_SHA, MIXED, NOTHING_REPORTED, shot, visualResponse } from "../visual-evidence-fixtures";

jest.mock("../../../../../../src/features/projects/detail/data/project-visual-api", () => ({
  getProjectVisualChecks: jest.fn(),
}));

const mockedChecks = getProjectVisualChecks as jest.MockedFunction<typeof getProjectVisualChecks>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
  jest.useRealTimers();
});

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(onSettled?: () => void, headSha: string | null = EVIDENCE_SHA): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<VisualEvidence projectId="p1" headSha={headSha} onSettled={onSettled} />);
  });
  await flush();
  return container;
}

function images(view: HTMLElement): HTMLImageElement[] {
  return [...view.querySelectorAll<HTMLImageElement>("img")];
}

describe("VisualEvidence", () => {
  it("reads the repository's latest uat run, once", async () => {
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    await render();
    expect(mockedChecks).toHaveBeenCalledTimes(1);
    expect(mockedChecks).toHaveBeenCalledWith("p1", "uat", null);
  });

  it("draws each changed or new screenshot with its reference and difference, captioned", async () => {
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    const view = await render();
    const rows = [...view.querySelectorAll(".vis-ev__snapshot")];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("home-desktop.png");
    expect(rows[0]?.textContent).toContain("Changed");
    expect([...rows[0]!.querySelectorAll("figcaption")].map((node) => node.textContent)).toEqual([
      "Reference",
      "New",
      "Difference",
    ]);
    expect(rows[1]?.textContent).toContain("New: no reference yet");
    expect([...rows[1]!.querySelectorAll("figcaption")].map((node) => node.textContent)).toEqual(["New"]);
  });

  it("serves the images from the API with the session cookie, as full URLs", async () => {
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    const view = await render();
    const base = getApiBaseUrl().replace(/\/+$/, "");
    expect(images(view)).toHaveLength(4);
    for (const image of images(view)) expect(image.src.startsWith(`${base}/projects/p1/workspace/visual/image?`)).toBe(true);
    expect(images(view)[0]?.alt).toBe("Reference: home-desktop.png");
  });

  it("only names the screenshots that matched, with no picture for them", async () => {
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    const view = await render();
    expect(view.querySelector(".vis-ev__matched")?.textContent).toContain("login-desktop.png");
    expect(images(view).some((image) => image.alt.includes("login-desktop"))).toBe(false);
  });

  it("says whose screenshots these are, and warns when uat has moved", async () => {
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    const same = await render(undefined, EVIDENCE_SHA);
    expect(same.textContent).toContain("Latest Verify run on uat, commit a1b2c3d.");
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    const moved = await render(undefined, "9999999aaaa");
    expect(moved.textContent).toContain("uat has moved since this run started");
  });

  it("says so when the repository reported no screenshots, and settles at once", async () => {
    mockedChecks.mockResolvedValue(NOTHING_REPORTED);
    const settled = jest.fn();
    const view = await render(settled);
    expect(view.textContent).toContain("No screenshots were reported for this repository on uat.");
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("says the screenshots are not in the report when they cannot be read, and settles so the print is not held", async () => {
    mockedChecks.mockRejectedValue(new ApiError("boom", 500));
    const settled = jest.fn();
    const view = await render(settled);
    expect(view.querySelector("[class*='note--error']")?.textContent).toContain("could not be read");
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("settles once every image has loaded, not before", async () => {
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    const settled = jest.fn();
    const view = await render(settled);
    const all = images(view);
    expect(settled).not.toHaveBeenCalled();
    for (const image of all.slice(0, -1)) act(() => void image.dispatchEvent(new Event("load")));
    expect(settled).not.toHaveBeenCalled();
    act(() => void all[all.length - 1]!.dispatchEvent(new Event("load")));
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("counts an image that fails as settled, so one broken screenshot cannot hold the print", async () => {
    mockedChecks.mockResolvedValue(visualResponse([shot("a.png", "new")]));
    const settled = jest.fn();
    const view = await render(settled);
    act(() => void images(view)[0]!.dispatchEvent(new Event("error")));
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("settles once however many events follow", async () => {
    mockedChecks.mockResolvedValue(visualResponse([shot("a.png", "new")]));
    const settled = jest.fn();
    const view = await render(settled);
    const image = images(view)[0]!;
    act(() => void image.dispatchEvent(new Event("load")));
    act(() => void image.dispatchEvent(new Event("load")));
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("gives up waiting for an image that never answers", async () => {
    jest.useFakeTimers();
    mockedChecks.mockResolvedValue(visualResponse(MIXED));
    const settled = jest.fn();
    await render(settled);
    expect(settled).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(EVIDENCE_IMAGE_WAIT_MS));
    expect(settled).toHaveBeenCalledTimes(1);
  });
});
