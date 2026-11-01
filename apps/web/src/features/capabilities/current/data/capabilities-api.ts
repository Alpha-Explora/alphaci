import type { CapabilitiesResponse } from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export function getCapabilities(): Promise<CapabilitiesResponse> {
  return request<CapabilitiesResponse>("/capabilities");
}
