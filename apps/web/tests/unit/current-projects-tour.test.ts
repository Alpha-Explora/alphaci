/**
 * Unit tests for the Current Projects onboarding tour step builder.
 *
 * driver.js is not tested as an integration (it requires a real DOM with
 * matching elements); instead we verify the step definitions that the tour
 * module exports independently of the driver instance.
 */

import {
  getCurrentProjectsTourSteps,
  createCurrentProjectsTour,
} from "../../src/features/workflows/studio/views/tours/current-projects-tour";

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

describe("getCurrentProjectsTourSteps", () => {
  it("returns a non-empty array of steps", () => {
    const steps = getCurrentProjectsTourSteps();
    expect(steps.length).toBeGreaterThan(0);
  });

  it("includes a step for the Projects heading", () => {
    const steps = getCurrentProjectsTourSteps();
    const step = steps.find((s) => s.element === "[data-tour='projects-list']");
    expect(step).toBeDefined();
    expect(step?.popover?.title).toBeTruthy();
  });

  /*
   * The sub-tab bar step was REMOVED on 2026-08-18: no element in the product
   * carries [data-tour='subtab-bar'] any more, so filterStepsForDom silently
   * dropped it on every run. This asserts it stays gone — a tour step that can
   * never render is worse than no step, because nothing reports it.
   */
  it("has no step anchored to an element that no longer exists", () => {
    const steps = getCurrentProjectsTourSteps();
    expect(
      steps.find((s) => s.element === "[data-tour='subtab-bar']"),
    ).toBeUndefined();
  });

  it("includes a step for the project detail tabs", () => {
    const steps = getCurrentProjectsTourSteps();
    const step = steps.find((s) => s.element === "[data-tour='project-detail-tabs']");
    expect(step).toBeDefined();
  });

  it("includes a step for the deployment targets list", () => {
    const steps = getCurrentProjectsTourSteps();
    const step = steps.find((s) => s.element === "[data-tour='deployment-targets']");
    expect(step).toBeDefined();
  });

  it("includes a step for the sync health checks", () => {
    const steps = getCurrentProjectsTourSteps();
    const step = steps.find((s) => s.element === "[data-tour='sync-health']");
    expect(step).toBeDefined();
  });

  it("first step targets the Projects heading", () => {
    const steps = getCurrentProjectsTourSteps();
    expect(steps[0]?.element).toBe("[data-tour='projects-list']");
  });

  /* The anchor sits at the top of the page, so a popover placed to its right
   * would cover the header actions. The page lost its team dropdown (the
   * header picker chooses the team), so the copy must not send anyone
   * looking for one. */
  it("places the first step below the heading and points at the header picker", () => {
    const steps = getCurrentProjectsTourSteps();
    expect(steps[0]?.popover?.side).toBe("bottom");
    expect(steps[0]?.popover?.description).not.toMatch(/sidebar|dropdown/i);
    expect(steps[0]?.popover?.description).toMatch(/header/i);
  });

  it("every step has a non-empty popover title and description", () => {
    const steps = getCurrentProjectsTourSteps();
    for (const step of steps) {
      expect(step.popover?.title?.trim()).toBeTruthy();
      expect(step.popover?.description?.trim()).toBeTruthy();
    }
  });

  it("every step has a valid element selector string", () => {
    const steps = getCurrentProjectsTourSteps();
    for (const step of steps) {
      expect(typeof step.element).toBe("string");
      expect((step.element as string).length).toBeGreaterThan(0);
    }
  });
});

describe("createCurrentProjectsTour", () => {
  // createCurrentProjectsTour filters steps to anchors present in the DOM.
  // Inject a matching element for every step selector so the full step set
  // survives filterStepsForDom.
  function injectAnchors() {
    for (const step of getCurrentProjectsTourSteps()) {
      const selector = step.element as string;
      // Only handle the [data-tour='value'] selector shape used by this tour.
      const attrMatch = selector.match(/^\[([^=]+)='([^']+)'\]$/);
      if (attrMatch) {
        const el = document.createElement("div");
        el.setAttribute(attrMatch[1], attrMatch[2]);
        document.body.appendChild(el);
      }
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
    const instance = createCurrentProjectsTour({ onFinished });
    expect(mockDriver).toHaveBeenCalledTimes(1);
    expect(instance).toBe(mockDriverInstance);
  });

  it("passes showProgress and allowClose to driver()", () => {
    const onFinished = jest.fn();
    createCurrentProjectsTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    expect(config.showProgress).toBe(true);
    expect(config.allowClose).toBe(true);
  });

  it("passes all steps to driver() when all anchors are in the DOM", () => {
    const onFinished = jest.fn();
    createCurrentProjectsTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    expect(Array.isArray(config.steps)).toBe(true);
    expect((config.steps as unknown[]).length).toBe(getCurrentProjectsTourSteps().length);
  });

  it("filters out steps whose anchor is absent from the DOM", () => {
    // Remove all injected anchors — only the guaranteed projects-list step should survive.
    document.body.replaceChildren();
    const onFinished = jest.fn();
    createCurrentProjectsTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    // Only the projects-list step (always retained) should be present.
    expect((config.steps as unknown[]).length).toBe(1);
  });

  it("onDestroyed fires onFinished exactly once", () => {
    const onFinished = jest.fn();
    createCurrentProjectsTour({ onFinished });
    const config = mockDriver.mock.calls[0][0] as Record<string, unknown>;
    const onDestroyed = config.onDestroyed as () => void;

    onDestroyed();
    expect(onFinished).toHaveBeenCalledTimes(1);

    // Calling again must not fire onFinished a second time (guard check).
    onDestroyed();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
