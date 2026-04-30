import type {
  GithubAppInstallUrlResponse,
  GithubInstallationAccountsResponse,
  LinkedGitHubReposResponse,
  LinkGithubInstallationResponse,
} from "./contracts";
import { request } from "./request";

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
