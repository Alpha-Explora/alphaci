import { request } from "@/shared/api/request";
import type { EnrollmentReceipt, MachineSummary } from "../model/host-types";
const path = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}`;
export async function isOnpremHostingAvailable(signal?: AbortSignal) {
  const response = await request<{
    providers?: { id: string; enabled: boolean }[];
  }>("/deployment-providers", { signal });
  return (
    response?.providers?.some(
      (provider) =>
        provider.id === "onprem-compose" && provider.enabled === true,
    ) === true
  );
}
export function listHosts(workspaceId: string, signal?: AbortSignal) {
  return request<MachineSummary[]>(`${path(workspaceId)}/onprem-hosts`, {
    signal,
  });
}
export function createHostEnrollment(
  workspaceId: string,
  input: {
    name: string;
    platform: "windows" | "ubuntu";
    requestId: string;
    replacesMachineId?: string;
  },
) {
  return request<EnrollmentReceipt>(
    `${path(workspaceId)}/onprem-host-enrollments`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
export function revokeHost(workspaceId: string, machineId: string) {
  return request<void>(
    `${path(workspaceId)}/onprem-hosts/${encodeURIComponent(machineId)}/revoke`,
    { method: "POST" },
  );
}
