import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { JobLogPanel } from "../../../../../../src/features/projects/detail/views/workspace/job-log-view";
import { useJobLogViewModel } from "../../../../../../src/features/projects/detail/view-models/use-run-jobs-view-model";
import { jobLogReady } from "../../../../../../src/features/projects/detail/model/failure-log-rules";
import { getProjectJobLog } from "../../../../../../src/features/projects/detail/data/project-workspace-api";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectJobLog: jest.fn(),
    getProjectRunJobs: jest.fn(),
  }),
);

const mockedJobLog = getProjectJobLog as jest.MockedFunction<typeof getProjectJobLog>;

/** A job row's log, the way pipeline-workflow-runs wires it. */
function Row({ jobStatus }: Readonly<{ jobStatus: string }>) {
  const view = useJobLogViewModel({ projectId: "p1", jobId: 7, ready: jobLogReady(jobStatus) });
  return (
    <div>
      <button type="button" onClick={view.toggle}>
        {view.open ? "Hide log" : "View log"}
      </button>
      {view.open && <JobLogPanel view={view} jobStatus={jobStatus} />}
    </div>
  );
}

describe("a job's log while the job runs", () => {
  let container: HTMLDivElement;
  let root: Root;
  const button = (label: string) =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedJobLog.mockResolvedValue({ available: true, content: "hello from the job", truncated: false });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("asks GitHub for nothing and says the log comes when the job finishes", async () => {
    act(() => root.render(<Row jobStatus="in_progress" />));
    await act(async () => button("View log")!.click());

    expect(mockedJobLog).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Log not ready yet");
    expect(container.textContent).toContain("this job is still running");
    expect(container.textContent).not.toContain("no access");
  });

  it("offers the log once the job has finished, and loads it on request", async () => {
    act(() => root.render(<Row jobStatus="in_progress" />));
    await act(async () => button("View log")!.click());

    act(() => root.render(<Row jobStatus="completed" />));
    expect(container.textContent).toContain("The job has finished");
    expect(mockedJobLog).not.toHaveBeenCalled();

    await act(async () => button("Show log")!.click());
    expect(mockedJobLog).toHaveBeenCalledWith("p1", 7);
    expect(container.textContent).toContain("hello from the job");
  });

  it("loads a finished job's log on open, as before", async () => {
    act(() => root.render(<Row jobStatus="completed" />));
    await act(async () => button("View log")!.click());
    expect(mockedJobLog).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("hello from the job");
  });
});

