import {
  canManageHosts,
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
