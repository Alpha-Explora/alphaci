import type { CapabilitiesResponse } from "./contracts";
import { request } from "./request";

export function getCapabilities(): Promise<CapabilitiesResponse> {
  return request<CapabilitiesResponse>("/capabilities");
}
