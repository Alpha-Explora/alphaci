import type { UsageMeResponse } from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export async function getMyUsage(): Promise<UsageMeResponse> {
  return request<UsageMeResponse>("/usage/me");
}
