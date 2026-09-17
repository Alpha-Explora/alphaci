import type { CapabilitiesResponse } from "../../../../../../src/shared/api/contracts";
import { disabledCapabilities } from "../../../../../../src/features/capabilities/current/data/capabilities-repository";
import { capabilityViewFlags } from "../../../../../../src/features/capabilities/current/model/capability-flags";

describe("client composition capability projection", () => {
  it("fails closed when a legacy capability response omits capability keys", () => {
    const legacyCapabilities = {
      ...disabledCapabilities(),
      clientComposition: {
        enabled: true,
        clientId: "legacy-client",
        displayName: "Legacy Client",
        edition: "enterprise",
        disabledCapabilities: [],
      },
    } as Omit<CapabilitiesResponse, "capabilityKeys">;
    delete (legacyCapabilities as Partial<CapabilitiesResponse>).capabilityKeys;

    expect(
      capabilityViewFlags(legacyCapabilities as CapabilitiesResponse)
        .clientCompositionEnabled,
    ).toBe(false);
  });

  it("requires both backend membership and the backend-owned enabled field", () => {
    const withoutProjection: CapabilitiesResponse = {
      ...disabledCapabilities(),
      capabilityKeys: ["runtime.client-composition"],
    };
    const withProjection: CapabilitiesResponse = {
      ...withoutProjection,
      clientComposition: {
        enabled: true,
        clientId: "northwind",
        displayName: "Northwind Industries",
        edition: "enterprise",
        disabledCapabilities: [],
      },
    };

    expect(capabilityViewFlags(withoutProjection).clientCompositionEnabled).toBe(
      false,
    );
    expect(capabilityViewFlags(withProjection).clientCompositionEnabled).toBe(
      true,
    );
  });
});
