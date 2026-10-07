import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CommitCard } from "../../../../../../src/features/projects/detail/views/workspace/pipeline-commit-card";
import {
  approveProjectVisualChecks,
  getProjectVisualChecks,
  getVisualImageBlob,
} from "../../../../../../src/features/projects/detail/data/project-visual-api";
import { downloadBlob } from "../../../../../../src/shared/browser/download-blob";
import type {
  VisualChecksResponse,
  VisualSnapshot,
} from "../../../../../../src/features/projects/detail/model/visual-check-types";
import type { CommitRunGroup } from "../../../../../../src/features/projects/detail/model/runs-by-commit";
import type { WorkflowRunSummary } from "../../../../../../src/features/projects/detail/view-models/use-pipeline-runs-view-model";
import type { AppRole, StageReport } from "../../../../../../src/shared/api/contracts";
import { ApiError, getApiBaseUrl } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/projects/detail/data/project-visual-api", () => ({
  getProjectVisualChecks: jest.fn(),
  approveProjectVisualChecks: jest.fn(),
  getVisualImageBlob: jest.fn(),
}));

jest.mock("../../../../../../src/shared/browser/download-blob", () => ({
  downloadBlob: jest.fn(),
}));

jest.mock("../../../../../../src/features/projects/detail/data/project-workspace-api", () => ({
  getProjectRunFailureLog: jest.fn().mockResolvedValue({ available: true, failures: [] }),
  getProjectJobLog: jest.fn(),
  getProjectRunJobs: jest.fn(),
}));

const mockedChecks = getProjectVisualChecks as jest.MockedFunction<typeof getProjectVisualChecks>;
const mockedApprove = approveProjectVisualChecks as jest.MockedFunction<typeof approveProjectVisualChecks>;
const mockedBlob = getVisualImageBlob as jest.MockedFunction<typeof getVisualImageBlob>;
const mockedSave = downloadBlob as jest.MockedFunction<typeof downloadBlob>;

const VERIFY_RUN = 77;

function path(kind: string, name: string, branch = "uat") {
  return `/projects/p1/workspace/visual/image?kind=${kind}&branch=${branch}&runId=${String(VERIFY_RUN)}&name=${name}`;
}

function shot(name: string, status: VisualSnapshot["status"], overrides: Partial<VisualSnapshot> = {}): VisualSnapshot {
  return {
    name,
    status,
    baselineUrl: status === "new" ? null : path("baseline", name),
    actualUrl: path("actual", name),
    diffUrl: status === "changed" ? path("diff", name) : null,
    baselineApprovedBy: status === "new" ? null : "lloyd",
    baselineApprovedAt: status === "new" ? null : "2026-10-01T08:00:00Z",
    inheritedFrom: null,
    approved: false,
    ...overrides,
  };
}

function checks(snapshots: VisualSnapshot[], overrides: Partial<VisualChecksResponse> = {}): VisualChecksResponse {
  return {
    branch: "uat",
    runId: VERIFY_RUN,
    commitSha: "aaaaaaa1",
    reportedAt: "2026-10-06T08:00:00Z",
    browser: "chromium",
    canApprove: true,
    snapshots,
    ...overrides,
  } as VisualChecksResponse;
}

const MIXED = [
  shot("about.png", "passed"),
  shot("signup.png", "new"),
  shot("home-mobile.png", "changed"),
  shot("home-desktop.png", "changed"),
];

function run(id: number): WorkflowRunSummary {
  return {
    id,
    name: "CI",
    displayTitle: "CI",
    headBranch: "uat",
    headSha: "aaaaaaa1",
    event: "push",
    status: "completed",
    conclusion: "success",
    runNumber: id,
    runAttempt: 1,
    htmlUrl: `https://github.com/org/repo/actions/runs/${String(id)}`,
    actor: "LloydLim1",
    createdAt: "2026-10-06T08:00:00Z",
    updatedAt: "2026-10-06T08:02:00Z",
  };
}

function stage(name: StageReport["stage"], runId: number): StageReport {
  return {
    stage: name,
    status: "success",
    runId,
    friendlyMessages: [],
    githubRunUrl: `https://github.com/org/repo/actions/runs/${String(runId)}`,
    updatedAt: "2026-10-06T08:02:00Z",
    checks: [{ name: `${name}-check`, conclusion: "success" }],
  };
}

function commit(branch: string): CommitRunGroup<WorkflowRunSummary> {
  const runs = [run(VERIFY_RUN), run(76)];
  return {
    commitSha: "aaaaaaa1",
    runs,
    latest: runs[0]!,
    report: {
      runId: 76,
      repoFullName: "org/repo",
      branch,
      commitSha: "aaaaaaa1",
      startedAt: "2026-10-06T08:00:00Z",
      overallStatus: "success",
      stages: [stage("access", 76), stage("quality", 76), stage("package", 76), stage("verify", VERIFY_RUN)],
    },
  } as CommitRunGroup<WorkflowRunSummary>;
}

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderCard(branch = "uat", appRole: AppRole | undefined = "member") {
  await act(async () => {
    root = createRoot(host);
    root.render(
      <ul>
        <CommitCard
          projectId="p1"
          branch={branch}
          commit={commit(branch)}
          title={null}
          appRole={appRole}
          repoFullName="Alpha-Explora/logistics2cicd-fe"
        />
      </ul>,
    );
  });
}

function button(name: string, scope: ParentNode = host): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll("button")].find((node) => node.textContent?.startsWith(name));
}

async function openVerify() {
  const verify = [...host.querySelectorAll<HTMLButtonElement>(".pipe-step__button")].find((node) =>
    node.textContent?.includes("Verify"),
  );
  await act(async () => verify!.click());
  await flush();
}

async function show(branch: string, response: VisualChecksResponse, appRole: AppRole | undefined = "member") {
  mockedChecks.mockResolvedValue(response);
  await renderCard(branch, appRole);
  await openVerify();
}

function panel(): HTMLElement {
  return host.querySelector<HTMLElement>(".pipe-visual")!;
}

function cardNames(): string[] {
  return [...host.querySelectorAll(".pipe-shot__name")].map((node) => node.textContent ?? "");
}

describe("Verify stage visual checks", () => {
  it("is read once, when the Verify stage opens, for the stage's own run", async () => {
    mockedChecks.mockResolvedValue(checks([]));
    await renderCard();
    expect(mockedChecks).not.toHaveBeenCalled();
    await openVerify();
    expect(mockedChecks).toHaveBeenCalledTimes(1);
    expect(mockedChecks).toHaveBeenCalledWith("p1", "uat", VERIFY_RUN);

    // Closing and reopening the stage does not read it again.
    await openVerify();
    await openVerify();
    expect(mockedChecks).toHaveBeenCalledTimes(1);
  });

  it("is never read on dev", async () => {
    await renderCard("dev");
    await openVerify();
    expect(mockedChecks).not.toHaveBeenCalled();
    expect(host.querySelector(".pipe-visual")).toBeNull();
  });

  it("says nothing has been reported yet", async () => {
    await show("uat", { branch: "uat", runId: null, canApprove: true, snapshots: [] });
    expect(panel().textContent).toContain(
      "No visual checks reported for uat yet. They run with the browser tests after each deploy.",
    );
    expect(host.querySelector(".pipe-shot")).toBeNull();
  });

  it("folds passing screenshots into a list whose thumbnails load when opened", async () => {
    await show("uat", checks([shot("b.png", "passed"), shot("a.png", "passed")]));
    expect(panel().querySelector(".pipe-visual__title")?.textContent).toBe("Visual checks · 2 unchanged");
    expect(host.querySelector(".pipe-shot")).toBeNull();
    expect(button("Approve", panel())).toBeUndefined();
    expect(host.querySelector(".pipe-visual__note")).toBeNull();
    expect(host.querySelector(".pipe-visual-chip")).toBeNull();

    const toggle = button("2 unchanged screenshots")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".pipe-passed img")).toBeNull();
    await act(async () => toggle.click());
    const rows = [...host.querySelectorAll(".pipe-passed__row")];
    expect(rows.map((row) => row.querySelector(".pipe-passed__name")?.textContent)).toEqual(["a.png", "b.png"]);
    expect(rows[0]!.querySelector("img")?.getAttribute("src")).toBe(`${getApiBaseUrl()}${path("actual", "a.png")}`);
  });

  it("orders changed, then new, then passed, with full API image URLs", async () => {
    await show("uat", checks(MIXED));
    expect(panel().querySelector(".pipe-visual__title")?.textContent).toBe(
      "Visual checks · 2 changed · 1 new · 1 unchanged",
    );
    expect(cardNames()).toEqual(["home-desktop.png", "home-mobile.png", "signup.png"]);

    const first = host.querySelector(".pipe-shot")!;
    expect([...first.querySelectorAll(".pipe-pane__label")].map((node) => node.textContent)).toEqual([
      "Reference",
      "New",
      "Difference",
    ]);
    const images = [...first.querySelectorAll("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      `${getApiBaseUrl()}${path("baseline", "home-desktop.png")}`,
      `${getApiBaseUrl()}${path("actual", "home-desktop.png")}`,
      `${getApiBaseUrl()}${path("diff", "home-desktop.png")}`,
    ]);
    expect(images.every((img) => img.getAttribute("loading") === "lazy")).toBe(true);
    expect(images[0]!.getAttribute("alt")).toBe("Reference screenshot of home-desktop.png");

    const added = host.querySelectorAll(".pipe-shot")[2]!;
    expect(added.textContent).toContain("No reference yet — approve to make this the reference.");
    expect(added.querySelectorAll("img")).toHaveLength(1);

    // Changed is visible on the stage and the stepper without opening anything else.
    expect(host.querySelector(".pipe-stage .pipe-visual-chip")?.textContent).toBe("Visual: 2 changed");
    expect(host.querySelector(".pipe-step__visual")?.textContent).toBe("Visual: 2 changed");
    expect(host.querySelector('a[href*="github.com"]')).toBeNull();
  });

  it("keeps the chip on the stepper after the stage is closed", async () => {
    await show("uat", checks(MIXED));
    await openVerify();
    expect(host.querySelector(".pipe-visual")).toBeNull();
    expect(host.querySelector(".pipe-step__visual")?.textContent).toBe("Visual: 2 changed");
  });

  it("notes main screenshots compared with uat's references", async () => {
    await show(
      "main",
      checks([shot("home.png", "changed", { inheritedFrom: "uat" })], { branch: "main" }),
    );
    expect(mockedChecks).toHaveBeenCalledWith("p1", "main", VERIFY_RUN);
    expect(panel().querySelector(".pipe-visual__inherit")?.textContent).toBe("inherits UAT references");
    expect(host.querySelector(".pipe-shot__meta")?.textContent).toContain("from UAT");
  });

  it("compares with a keyboard-operable slider", async () => {
    await show("uat", checks([shot("home.png", "changed")]));
    const compare = button("Compare")!;
    expect(compare.getAttribute("aria-pressed")).toBe("false");
    await act(async () => compare.click());
    const slider = host.querySelector<HTMLInputElement>('.pipe-compare input[type="range"]')!;
    expect(slider.getAttribute("aria-label")).toBe("Show the new screenshot of home.png");
    expect(slider.getAttribute("aria-valuetext")).toBe("50% new");
    expect(host.querySelectorAll(".pipe-compare img")).toHaveLength(2);
    expect(button("Side by side")?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("approving visual changes", () => {
  it("approves one screenshot: pending, then refetched, then Approved", async () => {
    await show("uat", checks(MIXED));
    let resolve: (value: { approved: string[] }) => void = () => undefined;
    mockedApprove.mockReturnValue(new Promise((done) => (resolve = done)));
    mockedChecks.mockResolvedValue(
      checks(MIXED.map((s) => (s.name === "home-desktop.png" ? { ...s, approved: true } : s))),
    );

    const card = host.querySelector(".pipe-shot")!;
    await act(async () => button("Approve new look", card)!.click());
    expect(mockedApprove).toHaveBeenCalledWith("p1", { branch: "uat", runId: VERIFY_RUN, names: ["home-desktop.png"] });
    expect(button("Approving…", card)?.getAttribute("aria-busy")).toBe("true");
    expect(button("Approve all", panel())?.disabled).toBe(true);

    await act(async () => resolve({ approved: ["home-desktop.png"] }));
    await flush();
    expect(mockedChecks).toHaveBeenCalledTimes(2);
    expect(mockedChecks).toHaveBeenLastCalledWith("p1", "uat", VERIFY_RUN);
    expect(host.querySelector(".pipe-shot")!.querySelector(".pipe-shot__approved")?.textContent).toBe("Approved");
    expect(button("Approve all (2)", panel())).toBeDefined();
  });

  it("approves every changed and new screenshot at once", async () => {
    await show("uat", checks(MIXED));
    mockedApprove.mockResolvedValue({ approved: ["home-desktop.png", "home-mobile.png", "signup.png"] });
    mockedChecks.mockResolvedValue(checks(MIXED.map((s) => (s.status === "passed" ? s : { ...s, approved: true }))));

    await act(async () => button("Approve all (3)", panel())!.click());
    await flush();
    expect(mockedApprove).toHaveBeenCalledWith("p1", {
      branch: "uat",
      runId: VERIFY_RUN,
      names: ["home-desktop.png", "home-mobile.png", "signup.png"],
    });
    expect(host.querySelectorAll(".pipe-shot__approved")).toHaveLength(3);
    expect(button("Approve", panel())).toBeUndefined();
  });

  it("offers the latest run when a newer one superseded this", async () => {
    await show("uat", checks(MIXED));
    mockedApprove.mockRejectedValue(
      new ApiError("409", 409, { code: "VISUAL_RUN_SUPERSEDED", latestRunId: 99, message: "newer" }),
    );
    await act(async () => button("Approve all (3)", panel())!.click());
    await flush();

    const alert = panel().querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("a newer visual run has been reported");
    mockedChecks.mockResolvedValue(checks([shot("home.png", "changed")], { runId: 99 }));
    await act(async () => button("Load latest run", alert)!.click());
    await flush();
    expect(mockedChecks).toHaveBeenLastCalledWith("p1", "uat", null);
    expect(cardNames()).toEqual(["home.png"]);
    expect(panel().querySelector('[role="alert"]')).toBeNull();
  });

  it("names the screenshots the server would not approve", async () => {
    await show("uat", checks(MIXED));
    mockedApprove.mockRejectedValue(
      new ApiError("409", 409, { code: "VISUAL_NOT_APPROVABLE", names: ["signup.png"] }),
    );
    await act(async () => button("Approve all (3)", panel())!.click());
    await flush();
    expect(panel().querySelector('[role="alert"]')?.textContent).toBe(
      "Nothing was approved: signup.png can't be approved — already passing, unknown, or without a captured screenshot.",
    );
    expect(button("Approve all (3)", panel())?.disabled).toBe(false);
  });

  it("hides the actions and explains when the server refuses the role", async () => {
    await show("uat", checks(MIXED));
    mockedApprove.mockRejectedValue(new ApiError("403", 403, { code: "VISUAL_APPROVE_ROLE_FORBIDDEN" }));
    await act(async () => button("Approve all (3)", panel())!.click());
    await flush();
    expect(button("Approve", panel())).toBeUndefined();
    expect(panel().querySelector(".pipe-visual__note")?.textContent).toContain(
      "Only developers, team leads and admins can approve visual changes.",
    );
  });

  it("is read-only for a role that cannot approve", async () => {
    await show("uat", checks(MIXED, { canApprove: false }), "qa");
    expect(button("Approve", panel())).toBeUndefined();
    expect(panel().querySelector('[role="note"]')?.textContent).toBe(
      "Only developers, team leads and admins can approve visual changes.",
    );
    expect(cardNames()).toEqual(["home-desktop.png", "home-mobile.png", "signup.png"]);
  });

  it("is read-only on a run that is not the latest, with a way to the latest", async () => {
    await show("uat", checks(MIXED, { canApprove: false }), "lead");
    expect(button("Approve", panel())).toBeUndefined();
    const note = panel().querySelector('[role="note"]')!;
    expect(note.textContent).toContain("This is not the latest visual run for uat, so it can't be approved here.");
    mockedChecks.mockResolvedValue(checks(MIXED));
    await act(async () => button("Load latest run", note)!.click());
    await flush();
    expect(mockedChecks).toHaveBeenLastCalledWith("p1", "uat", null);
    expect(button("Approve all (3)", panel())).toBeDefined();
  });

  it("offers a retry when the checks cannot be read", async () => {
    mockedChecks.mockRejectedValue(new Error("offline"));
    await renderCard();
    await openVerify();
    expect(panel().querySelector('[role="alert"]')?.textContent).toContain("The visual checks could not be read.");
    mockedChecks.mockResolvedValue(checks(MIXED));
    await act(async () => button("Retry", panel())!.click());
    await flush();
    expect(cardNames()).toHaveLength(3);
  });
});

describe("downloading visual snapshots", () => {
  function downloadNames(scope: ParentNode = host): string[] {
    return [...scope.querySelectorAll<HTMLButtonElement>(".pipe-download")].map(
      (node) => node.getAttribute("aria-label") ?? "",
    );
  }

  function download(label: string): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>(`.pipe-download[aria-label="${label}"]`)!;
  }

  it("offers one named download per image shown: reference, new and difference on a changed card", async () => {
    await show("uat", checks([shot("home-desktop.png", "changed")]));
    const card = host.querySelector(".pipe-shot")!;
    expect(downloadNames(card)).toEqual([
      "Download reference image of home-desktop.png",
      "Download new image of home-desktop.png",
      "Download difference image of home-desktop.png",
    ]);
    expect(card.querySelector(".pipe-download")?.textContent).toBe("Download");
  });

  it("offers only the new image on a new snapshot, and none for an image the snapshot lacks", async () => {
    await show("uat", checks([shot("signup.png", "new"), shot("odd.png", "changed", { diffUrl: null })]));
    const cards = [...host.querySelectorAll(".pipe-shot")];
    expect(downloadNames(cards.find((card) => card.textContent?.includes("signup.png")))).toEqual([
      "Download new image of signup.png",
    ]);
    expect(downloadNames(cards.find((card) => card.textContent?.includes("odd.png")))).toEqual([
      "Download reference image of odd.png",
      "Download new image of odd.png",
    ]);
  });

  it("offers reference and new downloads under the comparison slider", async () => {
    await show("uat", checks([shot("home-desktop.png", "changed")]));
    await act(async () => button("Compare")!.click());
    expect(downloadNames(host.querySelector(".pipe-compare")!)).toEqual([
      "Download reference image of home-desktop.png",
      "Download new image of home-desktop.png",
    ]);
  });

  it("offers a download for each unchanged screenshot once the list is opened", async () => {
    await show("uat", checks([shot("a.png", "passed"), shot("b.png", "passed")]));
    expect(host.querySelector(".pipe-download")).toBeNull();
    await act(async () => button("2 unchanged screenshots")!.click());
    expect(downloadNames(host.querySelector(".pipe-passed")!)).toEqual([
      "Download new image of a.png",
      "Download new image of b.png",
    ]);
  });

  it("fetches the image through the data layer and saves it under the rule's file name", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    mockedBlob.mockResolvedValue(blob);
    await show("uat", checks([shot("home-desktop.png", "changed")]));
    await act(async () => download("Download difference image of home-desktop.png").click());
    await flush();
    expect(mockedBlob).toHaveBeenCalledWith(`${getApiBaseUrl()}${path("diff", "home-desktop.png")}`);
    expect(mockedSave).toHaveBeenCalledWith("logistics2cicd-fe-uat-home-desktop-diff.png", blob);
    expect(host.querySelector(".pipe-visual [role='alert']")).toBeNull();
  });

  it("disables the button while its image is being fetched, then re-enables it", async () => {
    let finish: (value: Blob) => void = () => undefined;
    mockedBlob.mockReturnValue(new Promise<Blob>((done) => (finish = done)));
    await show("uat", checks([shot("home-desktop.png", "changed")]));
    const label = "Download reference image of home-desktop.png";
    await act(async () => download(label).click());
    expect(download(label).disabled).toBe(true);
    expect(download(label).getAttribute("aria-busy")).toBe("true");
    expect(download(label).textContent).toBe("Downloading…");
    expect(download("Download new image of home-desktop.png").disabled).toBe(false);

    await act(async () => download(label).click());
    expect(mockedBlob).toHaveBeenCalledTimes(1);

    await act(async () => finish(new Blob(["x"])));
    await flush();
    expect(download(label).disabled).toBe(false);
    expect(mockedSave).toHaveBeenCalledTimes(1);
  });

  it("says which image failed to download and lets the reader try again", async () => {
    mockedBlob.mockRejectedValueOnce(new ApiError("nope", 500));
    await show("uat", checks([shot("home-desktop.png", "changed")]));
    const label = "Download new image of home-desktop.png";
    await act(async () => download(label).click());
    await flush();
    expect(mockedSave).not.toHaveBeenCalled();
    expect(host.querySelector(".pipe-visual [role='alert']")?.textContent).toBe(
      "The new image of home-desktop.png could not be downloaded. Try again.",
    );
    expect(download(label).disabled).toBe(false);

    mockedBlob.mockResolvedValueOnce(new Blob(["png"]));
    await act(async () => download(label).click());
    await flush();
    expect(mockedSave).toHaveBeenCalledWith("logistics2cicd-fe-uat-home-desktop-new.png", expect.any(Blob));
    expect(host.querySelector(".pipe-visual [role='alert']")).toBeNull();
  });
});
