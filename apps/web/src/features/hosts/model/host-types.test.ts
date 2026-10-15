import {
  canManageHosts,
  countdownLabel,
  enrollmentProgress,
  hostStatusTone,
  lastSeenLabel,
  hostConnectionLabel,
  type MachineSummary,
} from "./host-types";
const host: MachineSummary = {
  id: "m",
  workspaceId: "w",
  name: "test",
  platform: "ubuntu",
  agentVersion: "1",
  lastSeenAt: "2026-10-15T00:00:00Z",
  status: "connected",
  checks: [],
};
it("expires connection evidence after ninety seconds without claiming application health", () => {
  expect(hostConnectionLabel(host, Date.parse(host.lastSeenAt!) + 90_001)).toBe(
    "Offline",
  );
  expect(hostConnectionLabel(host, Date.parse(host.lastSeenAt!) + 89_000)).toBe(
    "Connected",
  );
});
it("denies management to viewers and non-hosting personas", () => {
  expect(canManageHosts("member", "viewer")).toBe(false);
  expect(canManageHosts("qa", "admin")).toBe(false);
  expect(canManageHosts("lead", "admin")).toBe(false);
  expect(canManageHosts("member", "member")).toBe(true);
});
describe("enrollmentProgress", () => {
  const receipt = { id: "e1", expiresAt: "2026-10-15T00:15:00Z" };
  const now = Date.parse("2026-10-15T00:05:00Z");
  const pending: MachineSummary = {
    ...host,
    id: "e1",
    name: "box",
    status: "enrollment_pending",
    lastSeenAt: null,
  };
  it("waits while the enrollment row is still pending", () => {
    expect(enrollmentProgress(receipt, "box", [pending], now)).toBe("waiting");
  });
  it("reports connected once a machine with that name replaces the pending row", () => {
    expect(
      enrollmentProgress(
        receipt,
        "box",
        [{ ...host, id: "m2", name: "box" }],
        now,
      ),
    ).toBe("connected");
  });
  it("expires an unused code", () => {
    expect(
      enrollmentProgress(
        receipt,
        "box",
        [pending],
        Date.parse(receipt.expiresAt),
      ),
    ).toBe("expired");
  });
});
it("maps connection labels to tones and formats the code countdown", () => {
  expect(hostStatusTone("Connected")).toBe("success");
  expect(hostStatusTone("Prerequisites failed")).toBe("danger");
  expect(
    countdownLabel("2026-10-15T00:10:05Z", Date.parse("2026-10-15T00:00:00Z")),
  ).toBe("10:05");
  expect(lastSeenLabel(null)).toBe("Never connected");
});
