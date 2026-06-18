import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { NotificationCenter } from "../../src/components/layout/notification-center";

describe("NotificationCenter", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
  });

  it("shows unread count and marks unread notifications read", async () => {
    const onMarkRead = jest.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <NotificationCenter
          notifications={{
            enabled: true,
            unreadCount: 1,
            items: [
              {
                id: "notification-1",
                userId: "user-1",
                projectId: "project-1",
                eventCode: "project_created",
                title: "Project created",
                body: "orders-api is ready.",
                readAt: null,
                createdAt: "2026-06-15T00:00:00.000Z",
              },
            ],
          }}
          onMarkRead={onMarkRead}
        />,
      );
    });

    expect(container.textContent).toContain("1");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Notifications"]')!.click();
    });
    expect(container.textContent).toContain("Project created");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Mark read")!
        .click();
    });

    expect(onMarkRead).toHaveBeenCalledWith("notification-1");
  });

  it("renders an empty state", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <NotificationCenter
          notifications={{ enabled: true, unreadCount: 0, items: [] }}
          onMarkRead={jest.fn()}
        />,
      );
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Notifications"]')!.click();
    });

    expect(container.textContent).toContain("All caught up.");
  });
});
