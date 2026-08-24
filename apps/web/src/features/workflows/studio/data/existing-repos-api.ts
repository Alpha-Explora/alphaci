import type {
  DiscoverExistingRepoRequest,
  DiscoverExistingRepoResponse,
  SetupExistingRepoPrRequest,
  SetupExistingRepoPrResponse,
} from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export async function discoverExistingRepo(
  payload: DiscoverExistingRepoRequest,
): Promise<DiscoverExistingRepoResponse> {
  return request<DiscoverExistingRepoResponse>("/existing-repos/discover", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setupExistingRepoPullRequest(
  payload: SetupExistingRepoPrRequest,
): Promise<SetupExistingRepoPrResponse> {
  return request<SetupExistingRepoPrResponse>("/existing-repos/setup-pr", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
