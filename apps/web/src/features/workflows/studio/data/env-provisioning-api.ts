import type {
  CreateDeploymentTargetRequest,
  CreateProviderConnectionRequest,
  DeleteEnvVarMetadataResponse,
  DeploymentTarget,
  EnvVarMetadata,
  ProviderConnection,
  ProvisionEnvVarsRequest,
  ProvisionEnvVarsResponse,
  ValidateEnvVarsRequest,
  ValidateEnvVarsResponse,
} from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export function listProviderConnections(): Promise<ProviderConnection[]> {
  return request<ProviderConnection[]>("/provider-connections");
}

export function createProviderConnection(
  payload: CreateProviderConnectionRequest,
): Promise<ProviderConnection> {
  return request<ProviderConnection>("/provider-connections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeProviderConnection(id: string): Promise<{ revoked: boolean }> {
  return request<{ revoked: boolean }>(`/provider-connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listDeploymentTargets(projectId: string): Promise<DeploymentTarget[]> {
  return request<DeploymentTarget[]>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets`,
  );
}

export function createDeploymentTarget(
  projectId: string,
  payload: CreateDeploymentTargetRequest,
): Promise<DeploymentTarget> {
  return request<DeploymentTarget>(
    `/projects/${encodeURIComponent(projectId)}/deployment-targets`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function listProjectEnvMetadata(projectId: string): Promise<EnvVarMetadata[]> {
  return request<EnvVarMetadata[]>(
    `/projects/${encodeURIComponent(projectId)}/env-vars`,
  );
}

export function provisionProjectEnvVars(
  projectId: string,
  payload: ProvisionEnvVarsRequest,
): Promise<ProvisionEnvVarsResponse> {
  return request<ProvisionEnvVarsResponse>(
    `/projects/${encodeURIComponent(projectId)}/env-vars/provision`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function validateProjectEnvVars(
  projectId: string,
  payload: ValidateEnvVarsRequest,
): Promise<ValidateEnvVarsResponse> {
  return request<ValidateEnvVarsResponse>(
    `/projects/${encodeURIComponent(projectId)}/env-vars/validate`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteProjectEnvMetadata(
  projectId: string,
  metadataId: string,
): Promise<DeleteEnvVarMetadataResponse> {
  return request<DeleteEnvVarMetadataResponse>(
    `/projects/${encodeURIComponent(projectId)}/env-vars/${encodeURIComponent(metadataId)}`,
    {
      method: "DELETE",
    },
  );
}
