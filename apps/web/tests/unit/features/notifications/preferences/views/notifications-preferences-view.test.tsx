import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { NotificationsPreferencesView } from "../../../../../../src/features/notifications/preferences";
import { notificationsRepository } from "../../../../../../src/features/notifications/data/notifications-repository";

jest.mock("../../../../../../src/features/notifications/data/notifications-repository", () => ({
  notificationsRepository: {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
  },
}));

const mockedGetPreferences = notificationsRepository.getPreferences as jest.MockedFunction<
  typeof notificationsRepository.getPreferences
>;
const mockedUpdatePreferences = notificationsRepository.updatePreferences as jest.MockedFunction<
  typeof notificationsRepository.updatePreferences
>;

describe("NotificationsPreferencesView", () => {
  let root: Root | null = null;

  beforeEach(() => {
    mockedGetPreferences.mockResolvedValue({
      userId: "user-1",
      inAppEnabled: true,
      emailEnabled: false,
      updatedAt: "2026-06-15T00:00:00.000Z",
    });
    mockedUpdatePreferences.mockResolvedValue({
      userId: "user-1",
      inAppEnabled: false,
      emailEnabled: false,
      updatedAt: "2026-06-15T00:00:00.000Z",
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("loads preferences and updates in-app notification state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<NotificationsPreferencesView />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("In-app notifications");
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(true);

    await act(async () => {
      checkbox.click();
      await Promise.resolve();
    });

    expect(mockedUpdatePreferences).toHaveBeenCalledWith({ inAppEnabled: false });
  });

  it("renders email delivery as disabled", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<NotificationsPreferencesView />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Soon");
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(1);
    expect(container.querySelector(".notification-preferences-card--disabled")?.textContent).toContain(
      "Email notifications",
    );
  });
});
