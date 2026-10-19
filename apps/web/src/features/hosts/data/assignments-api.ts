import { request } from "@/shared/api/request";
import type {
  AssignmentDefaults,
  AssignmentRequestConfig,
  MachineAssignment,
  HostAssignment,
  ReadinessCheck,
} from "../model/host-types";
const path = (projectId: string, environmentId: string) =>
  `/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(environmentId)}`;
export function getAssignment(projectId: string, environmentId: string) {
  return request<HostAssignment | null>(
    `${path(projectId, environmentId)}/host-assignment`,
  );
}
/** The container port and health path per slot an assignment starts from. */
export function getAssignmentDefaults(projectId: string, environmentId: string) {
  return request<AssignmentDefaults>(
    `${path(projectId, environmentId)}/host-assignment/defaults`,
  );
}
export function getReadiness(projectId: string, environmentId: string) {
  return request<{ checks: ReadinessCheck[] }>(
    `${path(projectId, environmentId)}/onprem-readiness`,
  );
}
export function assignHost(
  projectId: string,
  environmentId: string,
  input: {
    /** Omitted: the workspace's only connected machine. */
    machineId?: string;
    expectedAssignmentId: string | null;
    requestId: string;
    config: AssignmentRequestConfig;
  },
) {
  return request<MachineAssignment>(
    `${path(projectId, environmentId)}/host-assignment`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
export function unassignHost(
  projectId: string,
  environmentId: string,
  expectedAssignmentId: string,
) {
  return request<void>(`${path(projectId, environmentId)}/host-assignment`, {
    method: "DELETE",
    body: JSON.stringify({ expectedAssignmentId }),
  });
}
