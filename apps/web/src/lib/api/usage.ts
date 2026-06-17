import type { UsageMeResponse } from "./contracts";
import { request } from "./request";

export async function getMyUsage(): Promise<UsageMeResponse> {
  return request<UsageMeResponse>("/usage/me");
}
