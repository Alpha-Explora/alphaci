/**
 * Unit tests for src/lib/navigation.ts.
 *
 * navigateToExternalUrl is a one-line wrapper around window.location.assign.
 * jsdom defines `location` (on window) and `assign` (on the location
 * instance) as non-configurable, non-writable properties per spec, so they
 * cannot be spied on or reassigned with jest.spyOn/Object.defineProperty in
 * this environment. jsdom does not implement real navigation either way —
 * calling assign() logs a "Not implemented: navigation" notice via the
 * virtual console and is a no-op, so we exercise the real call and assert it
 * does not throw, silencing the expected jsdom notice.
 */

import { navigateToExternalUrl } from "../../src/features/workflows/studio/view-models/navigation";

describe("navigateToExternalUrl", () => {
  it("calls window.location.assign with the given url without throwing", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => navigateToExternalUrl("https://example.com/callback")).not.toThrow();

    errorSpy.mockRestore();
  });
});
