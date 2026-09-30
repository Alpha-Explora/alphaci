import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { TeamsDetailView } from "../../../../../../src/features/teams/detail/views/teams-detail-view";

let mockSearch = "";
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => "/teams",
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

// "loading" keeps the page on its loader, so these tests see only the routing
// decision — nothing below the shell renders or fetches.
jest.mock("../../../../../../src/features/auth/session", () => ({
  useAuthSession: () => ({
    status: "loading",
    session: null,
    error: null,
    refresh: jest.fn(),
    signOut: jest.fn(),
    isSigningOut: false,
  }),
  isGuest: () => false,
}));

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  mockSearch = "";
  jest.clearAllMocks();
});

function render(search: string): HTMLElement {
  mockSearch = search;
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => root!.render(<TeamsDetailView />));
  return container;
}

/* The /teams rail is gone. Its sections are pages of their own, and a link
 * minted before (bookmark, email, another page's "Manage") must still land. */
describe("TeamsDetailView old section links", () => {
  it.each([
    ["?workspace=ws-1&section=qa-checklists&checklist=cl-1", "/checklists?workspace=ws-1&checklist=cl-1"],
    ["?workspace=ws-1&section=activity", "/activity?workspace=ws-1"],
    ["?workspace=ws-1&section=settings", "/settings?tab=team&workspace=ws-1"],
    ["?workspace=ws-1&section=projects&project=dp-1", "/workflows?group=ws-1&project=dp-1"],
    ["?workspace=ws-1&section=projects", "/workflows?group=ws-1"],
  ])("forwards %s to %s", (search, target) => {
    render(search);
    expect(mockReplace).toHaveBeenCalledWith(target);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it.each(["?workspace=ws-1&section=members", "?section=overview", "?workspace=ws-1", ""])(
    "keeps %s on /teams",
    (search) => {
      render(search);
      expect(mockReplace).not.toHaveBeenCalled();
    },
  );
});
