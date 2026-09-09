import { diagnoseRunWithoutJobs } from "@/features/projects/detail/model/run-diagnosis";

describe("diagnoseRunWithoutJobs", () => {
  it("names a rejected workflow instead of guessing at cancellation", () => {
    // The case every .NET failure this session actually was: the run concluded
    // in seconds having executed nothing, because the file itself was refused.
    const result = diagnoseRunWithoutJobs({
      status: "completed",
      conclusion: "failure",
    });

    expect(result.isFailure).toBe(true);
    expect(result.title).toContain("rejected");
    expect(result.message).toContain("secret");
  });

  it("treats GitHub's own startup_failure the same way", () => {
    expect(
      diagnoseRunWithoutJobs({
        status: "completed",
        conclusion: "startup_failure",
      }).isFailure,
    ).toBe(true);
  });

  it("does not call a cancelled run a failure", () => {
    const result = diagnoseRunWithoutJobs({
      status: "completed",
      conclusion: "cancelled",
    });

    expect(result.isFailure).toBe(false);
    expect(result.title).toContain("Cancelled");
  });

  it("does not call a still-queued run a failure", () => {
    // Jobs appear once GitHub schedules them; saying anything else here would
    // reintroduce the wrong guess in the other direction.
    const result = diagnoseRunWithoutJobs({ status: "queued", conclusion: null });

    expect(result.isFailure).toBe(false);
    expect(result.title).toContain("yet");
  });

  it("explains a fully skipped run", () => {
    const result = diagnoseRunWithoutJobs({
      status: "completed",
      conclusion: "skipped",
    });

    expect(result.isFailure).toBe(false);
    expect(result.message).toContain("branch condition");
  });

  it("stays neutral for a conclusion it does not recognise", () => {
    const result = diagnoseRunWithoutJobs({
      status: "completed",
      conclusion: "neutral",
    });

    expect(result.isFailure).toBe(false);
  });
});
