import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { notificationsRepository } from "../../../../../../src/features/notifications/data/notifications-repository";
import {
  useNotificationsInboxViewModel,
  type NotificationsInboxViewModel,
} from "../../../../../../src/features/notifications/inbox/view-models/use-notifications-inbox-view-model";

let mockCapabilities: Record<string, unknown> = {};
jest.mock("../../../../../../src/features/capabilities/current", () => ({
  ...jest.requireActual("../../../../../../src/features/capabilities/current"),
  useCapabilities: () => mockCapabilities,
}));

jest.mock("../../../../../../src/features/notifications/data/notifications-repository", () => ({
  notificationsRepository: { list: jest.fn() },
}));

const list = notificationsRepository.list as jest.Mock;

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  list.mockReset();
});

async function renderInbox(): Promise<NotificationsInboxViewModel> {
  const captured: { vm: NotificationsInboxViewModel | null } = { vm: null };
  const capture = (vm: NotificationsInboxViewModel) => {
    captured.vm = vm;
  };
  function Probe({ onRender }: { onRender: typeof capture }) {
    onRender(useNotificationsInboxViewModel(true, "u-inbox"));
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root!.render(<Probe onRender={capture} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return captured.vm!;
}

/* Every notifications route answers 404 while the capability is off. */
describe("useNotificationsInboxViewModel against the notifications capability", () => {
  it("shows the off state without reading notifications when the API reports them off", async () => {
    mockCapabilities = { status: "ready", notificationsEnabled: false };
    const vm = await renderInbox();
    expect(list).not.toHaveBeenCalled();
    expect(vm.status).toBe("ready");
    expect(vm.isEnabled).toBe(false);
    expect(vm.error).toBeNull();
  });

  it("keeps loading without reading notifications while /capabilities has not answered", async () => {
    mockCapabilities = { status: "loading", notificationsEnabled: false };
    const vm = await renderInbox();
    expect(list).not.toHaveBeenCalled();
    expect(vm.status).toBe("loading");
  });

  it("reads the feed once notifications are reported on", async () => {
    mockCapabilities = { status: "ready", notificationsEnabled: true };
    list.mockResolvedValue({ enabled: true, unreadCount: 0, items: [] });
    const vm = await renderInbox();
    expect(list).toHaveBeenCalledTimes(1);
    expect(vm.status).toBe("ready");
    expect(vm.isEnabled).toBe(true);
  });
});
