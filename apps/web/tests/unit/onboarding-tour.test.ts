/**
 * Unit tests for the Create Project onboarding tour step builder.
 *
 * driver.js is not tested as an integration (it requires a real DOM with
 * matching elements); instead we verify the step definitions that the tour
 * module exports independently of the driver instance.
 */

import {
  getProjectTourSteps,
  createProjectTour,
} from "../../src/lib/onboarding/create-project-tour";

// driver.js imports CSS at module level which jest-environment-jsdom cannot
// process. Stub the entire module so the tests focus on step logic only.
const mockDriverInstance = {
  drive: jest.fn(),
  destroy: jest.fn(),
};
const mockDriver = jest.fn(() => mockDriverInstance);

jest.mock("driver.js", () => ({
  driver: (...args: unknown[]) => mockDriver(...args),
}));

describe("getProjectTourSteps", () => {
  it("returns a non-empty array of steps", () => {
    const steps = getProjectTourSteps();
    expect(steps.length).toBeGreaterThan(0);
  });

  it("includes a step for the repo-shape selector", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "[data-tour='repo-shape']");
    expect(step).toBeDefined();
    expect(step?.popover?.title).toBeTruthy();
  });

  it("includes a step for the project type select", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#project-type-select");
    expect(step).toBeDefined();
  });

  it("includes a step for the workflow recipe select", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#workflow-recipe-select");
    expect(step).toBeDefined();
  });

  it("includes a step for the repository name input", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#repo-name");
    expect(step).toBeDefined();
  });

  it("includes a step for the repo visibility selector", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#repo-visibility");
    expect(step).toBeDefined();
  });

  it("includes a step for the service name input", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#service-name");
    expect(step).toBeDefined();
  });

  it("includes a step for the service path input", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#service-path");
    expect(step).toBeDefined();
  });

  it("includes a step for the output file name input", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#output-file-name");
    expect(step).toBeDefined();
  });

  it("includes a step for the node version selector", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#node-version");
    expect(step).toBeDefined();
  });

  it("includes a step for the coverage threshold selector", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "#coverage-threshold");
    expect(step).toBeDefined();
  });

  it("includes a step for the test toggles container", () => {
    const steps = getProjectTourSteps();
    const step = steps.find((s) => s.element === "[data-tour='test-toggles']");
    expect(step).toBeDefined();
  });

  it("final step targets the Create button", () => {
    const steps = getProjectTourSteps();
    const last = steps.at(-1);
    expect(last?.element).toBe("[data-testid='setup-project-button']");
  });

  it("every step has a non-empty popover title and description", () => {
    const steps = getProjectTourSteps();
    for (const step of steps) {
      expect(step.popover?.title?.trim()).toBeTruthy();
      expect(step.popover?.description?.trim()).toBeTruthy();
    }
  });

  it("every step has a valid element selector string", () => {
    const steps = getProjectTourSteps();
    for (const step of steps) {
      expect(typeof step.element).toBe("string");
      expect((step.element as string).length).toBeGreaterThan(0);
    }
  });
});

describe("createProjectTour", () => {
  // createProjectTour filters steps to anchors present in the DOM. Inject a
  // matching element for every step selector so the full step set survives.
  function injectAnchors() {
    for (const step of getProjectTourSteps()) {
      const selector = step.element as string;
      const el = document.createElement("div");
      const idMatch = selector.match(/^#(.+)$/);
      const attrMatch = selector.match(/^\[([^=]+)='([^']+)'\]$/);
      if (idMatch) {
        el.id = idMatch[1];
      } else if (attrMatch) {
        el.setAttribute(attrMatch[1], attrMatch[2]);
      }
      document.body.appendChild(el);
    }
  }

  beforeEach(() => {
    mockDriver.mockClear();
    mockDriverInstance.drive.mockClear();
    mockDriverInstance.destroy.mockClear();
    injectAnchors();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("calls driver() and returns the instance", () => {
    const onFinished = jest.fn();
    const instance = createProjectTour({ onFinished });
    expect(mockDriver).toHaveBeenCalledTimes(1);
    expect(instance).toBe(mockDriverInstance);
  });

  it("passes showProgress and allowClose to driver()", () => {
    const onFinished = jest.fn();
    createProjectTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    expect(config.showProgress).toBe(true);
    expect(config.allowClose).toBe(true);
  });

  it("passes the steps array to driver()", () => {
    const onFinished = jest.fn();
    createProjectTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    expect(Array.isArray(config.steps)).toBe(true);
    expect((config.steps as unknown[]).length).toBe(getProjectTourSteps().length);
  });

  it("onDestroyed fires onFinished exactly once", () => {
    const onFinished = jest.fn();
    createProjectTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    const onDestroyed = config.onDestroyed as () => void;

    onDestroyed();
    expect(onFinished).toHaveBeenCalledTimes(1);

    // Calling again must not fire onFinished a second time (guard check).
    onDestroyed();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
