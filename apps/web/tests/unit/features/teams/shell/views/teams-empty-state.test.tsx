import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { TeamsEmptyState } from "../../../../../../src/features/teams/shell/views/teams-empty-state";

/**
 * The screen a Lead lands on with no team to their name. The action that
 * resolves that state belongs here rather than as a sentence pointing at the
 * header — telling someone where else to click is a worse answer than letting
 * them click.
 */
describe("TeamsEmptyState", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  function render(canCreate: boolean) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<TeamsEmptyState canCreate={canCreate} />);
    });
    return container;
  }

  it("gives a lead a create button on the page itself", () => {
    const container = render(true);

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="teams-create-workspace-button"]',
    );
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Create workspace");
  });

  /* A Developer cannot create one, so the copy has to explain who can rather
   * than offer an action that would only 403. */
  it("tells a developer who can add them, and offers no button", () => {
    const container = render(false);

    expect(
      container.querySelector('[data-testid="teams-create-workspace-button"]'),
    ).toBeNull();
    expect(container.textContent).toContain("team lead has to add you");
  });

  it("says the caller is in no team either way", () => {
    expect(render(true).textContent).toContain("not in a team yet");
    document.body.innerHTML = "";
    expect(render(false).textContent).toContain("not in a team yet");
  });
});
