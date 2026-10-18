import { QUIET_AFTER_MS, quietAgo, quietSince } from "../../../../../../src/features/projects/deployment-logs/model/log-quiet";

describe("quiet live tail", () => {
  const lines = [{ timestamp: "2026-10-16T15:13:45.000Z" }, { timestamp: "2026-10-16T15:30:16.000Z" }];
  const newest = Date.parse("2026-10-16T15:30:16.000Z");

  it("says nothing while lines are recent", () => {
    expect(quietSince(lines, newest + QUIET_AFTER_MS - 1)).toBeNull();
    expect(quietSince([], newest + QUIET_AFTER_MS * 10)).toBeNull();
  });

  it("names the newest line once the tail has been silent for 15 minutes", () => {
    const now = newest + 3 * 24 * 3_600_000;
    expect(quietSince([...lines].reverse(), now)).toBe("2026-10-16T15:30:16.000Z");
    expect(quietAgo("2026-10-16T15:30:16.000Z", now)).toBe("3 days ago");
    expect(quietAgo("2026-10-16T15:30:16.000Z", newest + 20 * 60_000)).toBe("20 minutes ago");
  });
});
