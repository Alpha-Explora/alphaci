import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { NotificationPreferencesSection } from "../../src/components/settings/notification-preferences-section";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../../src/lib/api/notifications";

jest.mock("../../src/lib/api/notifications", () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));

const mockedGetPreferences = getNotificationPreferences as jest.MockedFunction<typeof getNotificationPreferences>;
const mockedUpdatePreferences = updateNotificationPreferences as jest.MockedFunction<typeof updateNotificationPreferences>;

describe("NotificationPreferencesSection", () => {
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
      root!.render(<NotificationPreferencesSection />);
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
      root!.render(<NotificationPreferencesSection />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Email delivery unavailable.");
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes[1]?.disabled).toBe(true);
  });
});
