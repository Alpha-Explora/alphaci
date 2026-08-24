import type {
  GitHubReposResponse,
  GithubAppInstallUrlResponse,
  GithubInstallationAccountsResponse,
  LinkedGitHubReposResponse,
  LinkGithubInstallationResponse,
} from "@/shared/api/contracts";
import { request } from "@/shared/api/request";

export async function getGithubAppInstallUrl(): Promise<GithubAppInstallUrlResponse> {
  return request<GithubAppInstallUrlResponse>("/github/app/install-url");
}

export async function linkGithubInstallation(
  installationId: number,
): Promise<LinkGithubInstallationResponse> {
  return request<LinkGithubInstallationResponse>("/github/installations", {
    method: "POST",
    body: JSON.stringify({ installationId }),
  });
}

export async function getLinkedGithubRepos(): Promise<LinkedGitHubReposResponse> {
  return request<LinkedGitHubReposResponse>("/github/installations/repos");
}

export async function getGithubInstallationAccounts(): Promise<GithubInstallationAccountsResponse> {
  return request<GithubInstallationAccountsResponse>("/github/installations/accounts");
}

export async function getGithubRepos(): Promise<GitHubReposResponse> {
  return request<GitHubReposResponse>("/github/repos");
}

export async function createGithubRepo(
  payload: import("@/shared/api/contracts").CreateGithubRepoRequest,
): Promise<import("@/shared/api/contracts").CreateGithubRepoResponse> {
  return request<import("@/shared/api/contracts").CreateGithubRepoResponse>("/github/repos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
