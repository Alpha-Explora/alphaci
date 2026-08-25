import type {
  GenerateWorkflowRequest,
  GenerateWorkflowResponse,
  WorkflowHistoryResponse,
} from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export async function generateWorkflow(
  payload: GenerateWorkflowRequest,
): Promise<GenerateWorkflowResponse> {
  return request<GenerateWorkflowResponse>("/workflows/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWorkflowHistory(limit = 25): Promise<WorkflowHistoryResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return request<WorkflowHistoryResponse>(`/workflows/history?limit=${safeLimit}`);
}
