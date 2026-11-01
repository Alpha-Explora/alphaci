/**
 * create-project-tour.ts
 *
 * Builds and returns a configured driver.js instance that guides a new user
 * step-by-step through the Create Project (Setup) form.
 *
 * Client-only module — must never be imported in a Server Component.
 */

import { driver, type DriveStep, type Driver } from "driver.js";

export interface TourCallbacks {
  /** Called once when the tour finishes (completed all steps or user skipped). */
  onFinished: () => void;
}

/**
 * The selector for the final Create-button step. This step is always kept
 * in the filtered set regardless of DOM presence — the button is guaranteed
 * to exist whenever the Setup form is rendered.
 */
const CREATE_BUTTON_SELECTOR = "[data-testid='setup-project-button']";

/** Ordered tour steps anchored to the Setup form. */
function buildSteps(): DriveStep[] {
  return [
    {
      element: "[data-tour='repo-shape']",
      popover: {
        title: "Repository shape",
        description:
          "Choose how your project is organised. Standalone is recommended for a single service. Microservices splits backend and frontend into sub-directories inside one repo; Multi-repo creates two separate GitHub repositories.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#project-type-select",
      popover: {
        title: "Language and framework",
        description:
          "Pick the tech stack for your project — for example NestJS for a backend API or Next.js for a frontend app. The workflow recipe and CI jobs will be tailored to this choice.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#workflow-recipe-select",
      popover: {
        title: "Workflow recipe",
        description:
          "A recipe is a preset combination of CI jobs — lint, test, build, security, and more. Standard CI covers most teams well.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#repo-name",
      popover: {
        title: "Name your repository",
        description:
          "This becomes your GitHub repository name, and the service takes the same name. Use lowercase words separated by hyphens — for example my-first-service. The name must be unique within your GitHub account or organisation.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#repo-visibility",
      popover: {
        title: "Visibility",
        description:
          "Private keeps your code visible only to collaborators. Public makes the repository open to everyone on GitHub. You can change this later in GitHub repository settings.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#node-version",
      popover: {
        title: "Node version",
        description:
          "The version of Node.js that the CI runner will use. Pick the same version your project targets locally. Node 22 LTS is a safe default for new projects.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#coverage-threshold",
      popover: {
        title: "Coverage threshold",
        description:
          "The minimum percentage of code that must be covered by tests before the pipeline passes. Standard (80%) is a solid starting point. You can raise or lower this at any time.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: CREATE_BUTTON_SELECTOR,
      popover: {
        title: "Ready to create",
        description:
          "When you are happy with the settings above, click this button to provision your GitHub repository, create the main, uat, and test branches, and commit the generated workflow file. This is the real action — no confirmation step.",
        side: "top",
        align: "center",
      },
    },
  ];
}

/**
 * Filters steps so that only those whose anchor element currently exists in
 * the DOM are included. The Create-button step is always retained because
 * the button is guaranteed to be present whenever the Setup form is rendered.
 *
 * This prevents driver.js from erroring or jumping when fields that are
 * conditionally rendered (e.g. #node-version only appears for a stack that
 * runs on Node) are absent from the DOM at tour-start time.
 */
export function filterStepsForDom(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    const selector = step.element as string | undefined;
    if (!selector) return true;
    // Always keep the create-button step.
    if (selector === CREATE_BUTTON_SELECTOR) return true;
    return document.querySelector(selector) !== null;
  });
}

/**
 * Creates a configured driver.js instance.
 * Steps are filtered to those present in the DOM at call time, so conditional
 * form fields that are not rendered for the current repo shape are skipped.
 *
 * Caller is responsible for calling `.drive()` to start the tour.
 * The `onFinished` callback fires exactly once when the tour ends
 * (whether the user completes all steps or dismisses early).
 */
export function createProjectTour(callbacks: TourCallbacks): Driver {
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
export function getProjectTourSteps(): DriveStep[] {
  return buildSteps();
}
