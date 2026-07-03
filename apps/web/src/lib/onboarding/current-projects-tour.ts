/**
 * current-projects-tour.ts
 *
 * Builds and returns a configured driver.js instance that guides users
 * through the Current Projects tab — the provisioned-project workspace.
 *
 * Client-only module — must never be imported in a Server Component.
 */

import { driver, type DriveStep, type Driver } from "driver.js";

export interface TourCallbacks {
  /** Called once when the tour finishes (completed all steps or user dismissed). */
  onFinished: () => void;
}

/**
 * The selector for the first step that is always present when the Current
 * Projects tab is active and at least one project exists. The projects-list
 * aside is rendered unconditionally once the tab is active, so we use it as
 * the guaranteed anchor.
 */
const PROJECTS_LIST_SELECTOR = "[data-tour='projects-list']";

/** Ordered tour steps anchored to DOM elements in workflow-current-tab.tsx. */
function buildSteps(): DriveStep[] {
  return [
    {
      element: PROJECTS_LIST_SELECTOR,
      popover: {
        title: "Your provisioned projects",
        description:
          "This sidebar lists every GitHub repository Alphaexplora has provisioned for you. Click any project to open its detail view on the right. Use the New button at the top to set up another project.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "[data-tour='subtab-bar']",
      popover: {
        title: "Projects vs History",
        description:
          "Switch between Projects (your active provisioned repos) and History (a log of every setup run, including failed attempts). History is useful for diagnosing past provisioning errors.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='project-detail-tabs']",
      popover: {
        title: "Project detail tabs",
        description:
          "Once a project is selected, these tabs let you inspect every aspect of it — Overview, Workflow YAML, CI Runs, Deployment targets, Environment variables, Activity log, Audit trail, and Settings. Start with Overview to see the current health of your project.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='deployment-targets']",
      popover: {
        title: "Deployment targets",
        description:
          "Deployment targets link your repository to a hosting provider such as Render. Each target shows which slot (test/uat/main) and branch it tracks. Use Edit to update settings, Sync to pull the latest provider state, or Detach to disconnect Alphaexplora from a provider project.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='sync-health']",
      popover: {
        title: "Health checks",
        description:
          "Alphaexplora runs a set of automated checks against each project — CI token validity, workflow file presence, branch protection rules, and more. Green rows mean everything is in order. Red rows show what needs attention before your pipeline will work correctly.",
        side: "top",
        align: "start",
      },
    },
  ];
}

/**
 * Filters steps so that only those whose anchor element currently exists in
 * the DOM are included. The projects-list step is always retained — it is the
 * one element guaranteed to be rendered whenever this tour is launched.
 *
 * Most detail-pane anchors (tabs, deployment targets, health checks) only
 * appear when a project is selected; skipping absent steps prevents driver.js
 * from erroring or jumping to an off-screen position.
 */
export function filterStepsForDom(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    const selector = step.element as string | undefined;
    if (!selector) return true;
    if (selector === PROJECTS_LIST_SELECTOR) return true;
    return document.querySelector(selector) !== null;
  });
}

/**
 * Creates a configured driver.js instance for the Current Projects tour.
 * Steps are filtered to those present in the DOM at call time, so elements
 * that only render after project selection are skipped gracefully.
 *
 * Caller is responsible for calling `.drive()` to start the tour.
 * The `onFinished` callback fires exactly once when the tour ends.
 */
export function createCurrentProjectsTour(callbacks: TourCallbacks): Driver {
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    callbacks.onFinished();
  }

  const steps = filterStepsForDom(buildSteps());

  return driver({
    showProgress: true,
    allowClose: true,
    smoothScroll: true,
    showButtons: ["next", "previous", "close"],
    steps,
    onDestroyed: finish,
  });
}

/** Returns the ordered step definitions — useful for unit tests. */
export function getCurrentProjectsTourSteps(): DriveStep[] {
  return buildSteps();
}
