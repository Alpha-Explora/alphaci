import type {
  DiscoverExistingRepoRequest,
  DiscoverExistingRepoResponse,
  SetupExistingRepoPrRequest,
  SetupExistingRepoPrResponse,
} from "./contracts";
import { request } from "./request";

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
