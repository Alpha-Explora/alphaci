import {
  isGlobalCreatorRole,
  isGroupManagerRole,
  projectStatusVariant,
  repoShortName,
} from "../../../../../src/features/groups/model/groups-rules";

describe("groups role rules", () => {
  it("treats admin and delegated_lead as group managers", () => {
    expect(isGroupManagerRole("admin")).toBe(true);
    expect(isGroupManagerRole("delegated_lead")).toBe(true);
  });

  it("denies member and viewer", () => {
    expect(isGroupManagerRole("member")).toBe(false);
    expect(isGroupManagerRole("viewer")).toBe(false);
    expect(isGroupManagerRole(null)).toBe(false);
  });

  it("restricts global creation to admins and leads", () => {
    expect(isGlobalCreatorRole("admin")).toBe(true);
    expect(isGlobalCreatorRole("lead")).toBe(true);
    expect(isGlobalCreatorRole("member")).toBe(false);
  });
});

describe("project status presentation", () => {
  it("maps lifecycle states to badge variants", () => {
    expect(projectStatusVariant("provisioned")).toBe("provisioned");
    expect(projectStatusVariant("provisioning")).toBe("provisioning");
    expect(projectStatusVariant("pending")).toBe("provisioning");
    expect(projectStatusVariant("failed")).toBe("failed");
    expect(projectStatusVariant("unknown")).toBe("failed");
  });
});

describe("repoShortName", () => {
  it("returns the name after the owner slash", () => {
    expect(repoShortName("acme/orders-api")).toBe("orders-api");
  });

  it("falls back to the whole string when there is no slash", () => {
    expect(repoShortName("orders-api")).toBe("orders-api");
  });
});
