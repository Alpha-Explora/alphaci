import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { groupsRepository } from "../../../../../../src/features/groups/data/groups-repository";
import type { InternalUserDirectoryEntry } from "../../../../../../src/features/groups/model/groups-types";
import {
  DIRECTORY_SEARCH_DEBOUNCE_MS,
  useAddMemberViewModel,
  type AddMemberViewModel,
} from "../../../../../../src/features/groups/workspace/view-models/use-add-member-view-model";

jest.mock("../../../../../../src/features/groups/data/groups-repository", () => ({
  groupsRepository: {
    eligibleMembers: jest.fn(),
    addMember: jest.fn(),
  },
}));

const mockedEligible = groupsRepository.eligibleMembers as jest.MockedFunction<
  typeof groupsRepository.eligibleMembers
>;
const mockedAdd = groupsRepository.addMember as jest.MockedFunction<
  typeof groupsRepository.addMember
>;

const entry = (login: string, hasAccount = true): InternalUserDirectoryEntry => ({
  id: hasAccount ? `${login}-id` : null,
  login,
  name: login,
  email: null,
  avatarUrl: null,
  hasAccount,
});

interface Harness {
  latest: AddMemberViewModel | null;
}

describe("useAddMemberViewModel", () => {
  let root: Root | null = null;
  const onAdded = jest.fn();
  const onClose = jest.fn();

  function render(open: boolean): Harness {
    const harness: Harness = { latest: null };
    function Probe() {
      const vm = useAddMemberViewModel({ open, groupId: "group-1", onAdded, onClose });
      useEffect(() => {
        harness.latest = vm;
      });
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Probe />));
    return harness;
  }

  /** Lets the debounce fire and the repository promise settle. */
  async function flushSearch() {
    await act(async () => {
      jest.advanceTimersByTime(DIRECTORY_SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mockedEligible.mockResolvedValue([entry("bpramos-ae"), entry("not-signed-in", false)]);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("loads the directory when opened and lists who can be added", async () => {
    const harness = render(true);
    expect(harness.latest?.status).toBe("loading");

    await flushSearch();

    expect(mockedEligible).toHaveBeenCalledWith("group-1", "");
    expect(harness.latest?.status).toBe("ready");
    expect(harness.latest?.results.map((user) => user.login)).toEqual([
      "bpramos-ae",
      "not-signed-in",
    ]);
    expect(harness.latest?.emptyMessage).toBeNull();
  });

  it("does not read the directory while closed", async () => {
    const harness = render(false);
    await flushSearch();

    expect(mockedEligible).not.toHaveBeenCalled();
    expect(harness.latest?.status).toBe("idle");
  });

  it("shows the server's reason when the directory is unreadable", async () => {
    mockedEligible.mockRejectedValue({
      status: 503,
      details: { message: "The Alpha-Explora GitHub organization could not be read." },
    });
    const harness = render(true);

    await flushSearch();

    expect(harness.latest?.status).toBe("error");
    expect(harness.latest?.error).toBe(
      "The Alpha-Explora GitHub organization could not be read.",
    );
  });

  it("explains an empty answer instead of showing nothing", async () => {
    mockedEligible.mockResolvedValue([]);
    const harness = render(true);
    await flushSearch();

    act(() => harness.latest!.setSearch("zz"));
    await flushSearch();

    expect(mockedEligible).toHaveBeenLastCalledWith("group-1", "zz");
    expect(harness.latest?.emptyMessage).toBe('No organization members match "zz".');
  });

  it("drops an answer that arrives after a newer search began", async () => {
    let resolveSlow: (value: InternalUserDirectoryEntry[]) => void = () => undefined;
    mockedEligible
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveSlow = resolve)),
      )
      .mockResolvedValueOnce([entry("bpramos-ae")]);
    const harness = render(true);
    await flushSearch(); // the slow first request is now in flight

    act(() => harness.latest!.setSearch("bp"));
    await flushSearch();
    await act(async () => {
      resolveSlow([entry("stale-result")]);
      await Promise.resolve();
    });

    expect(harness.latest?.results.map((user) => user.login)).toEqual(["bpramos-ae"]);
  });

  it("refuses to pick someone without an account", async () => {
    const harness = render(true);
    await flushSearch();

    act(() => harness.latest!.select(entry("not-signed-in", false)));

    expect(harness.latest?.selectedUser).toBeNull();
    expect(harness.latest?.canSubmit).toBe(false);
  });

  it("adds the picked member, then closes", async () => {
    const member = { id: "member-9", userId: "bpramos-ae-id" };
    mockedAdd.mockResolvedValue(member as never);
    const harness = render(true);
    await flushSearch();

    act(() => harness.latest!.select(entry("bpramos-ae")));
    expect(harness.latest?.canSubmit).toBe(true);
    expect(harness.latest?.status).toBe("idle");

    await act(async () => {
      await harness.latest!.submit();
    });

    expect(mockedAdd).toHaveBeenCalledWith("group-1", { userId: "bpramos-ae-id" });
    expect(onAdded).toHaveBeenCalledWith(member);
    expect(onClose).toHaveBeenCalled();
    expect(harness.latest?.selectedUser).toBeNull();
  });

  it("keeps the dialog open with the server's reason when the add is refused", async () => {
    mockedAdd.mockRejectedValue({
      status: 404,
      details: { message: "bpramos-ae is not a member of the Alpha-Explora GitHub organization." },
    });
    const harness = render(true);
    await flushSearch();
    act(() => harness.latest!.select(entry("bpramos-ae")));

    await act(async () => {
      await harness.latest!.submit();
    });

    expect(harness.latest?.error).toBe(
      "bpramos-ae is not a member of the Alpha-Explora GitHub organization.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(harness.latest?.submitting).toBe(false);
  });
});
