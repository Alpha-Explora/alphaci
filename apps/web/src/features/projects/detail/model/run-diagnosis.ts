/**
 * What it means when a run recorded no jobs.
 *
 * The panel used to say "It may have been cancelled before starting" for every
 * such run. That is the wrong guess for the common case, and it is a guess: a
 * completed run that concluded in failure with no jobs was not cancelled — its
 * workflow file was rejected before any job could start, which is a different
 * problem with a different fix.
 *
 * This is where every .NET failure this session actually lived. A cross-org
 * private `uses:`, a secret the called workflow does not declare, invalid YAML —
 * each produces a run that concludes in seconds having executed nothing, and
 * each was diagnosed by reading the GitHub API by hand because the product had
 * nothing to say about it.
 *
 * Pure, so the wording is testable and does not live inside JSX.
 */

export interface RunDiagnosis {
  title: string;
  message: string;
  /** True when this is a real problem rather than a normal empty state. */
  isFailure: boolean;
}

export interface RunDiagnosisInput {
  /** GitHub run status: 'queued' | 'in_progress' | 'completed' | ... */
  status: string;
  /** GitHub conclusion, null while the run is not finished. */
  conclusion: string | null;
}

/**
 * Diagnose a completed-but-empty run.
 *
 * Only called when a run reported zero jobs; a run with jobs explains itself.
 */
export function diagnoseRunWithoutJobs(run: RunDiagnosisInput): RunDiagnosis {
  if (run.status !== "completed") {
    return {
      title: "No jobs yet",
      message:
        "This run has not started its jobs. They appear here once GitHub schedules them.",
      isFailure: false,
    };
  }

  if (run.conclusion === "cancelled") {
    return {
      title: "Cancelled before starting",
      message: "This run was cancelled before any job began.",
      isFailure: false,
    };
  }

  if (run.conclusion === "skipped") {
    return {
      title: "Skipped",
      message:
        "Every job in this run was skipped, usually because no branch condition matched.",
      isFailure: false,
    };
  }

  if (run.conclusion === "failure" || run.conclusion === "startup_failure") {
    return {
      title: "The workflow was rejected before it ran",
      message:
        "This run finished without starting a single job, which means GitHub refused the workflow file itself. The usual causes are a referenced workflow it cannot resolve, a secret the called workflow does not declare, or invalid YAML. Open the run on GitHub — the reason is named at the top.",
      isFailure: true,
    };
  }

  return {
    title: "No jobs",
    message: "This run recorded no jobs.",
    isFailure: false,
  };
}
