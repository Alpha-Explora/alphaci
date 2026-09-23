import { getApiBaseUrl, request } from "@/shared/api/request";

import type {
  DeploymentLogsQuery,
  DeploymentLogsResponse,
  DeploymentLogStreamEvent,
} from "../model/deployment-logs-types";
import {
  normalizeLogsResponse,
  normalizeStreamEvent,
} from "../model/log-normalize";

/** The provider's page ceiling; the backend clamps to it as well. */
export const LOG_PAGE_LIMIT = 100;

function logsPath(projectId: string, targetId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/deployment-targets/${encodeURIComponent(targetId)}/logs`;
}

function setList(params: URLSearchParams, key: string, values?: readonly string[]) {
  if (values?.length) params.set(key, values.join(","));
}

/** The contract's query string. Lists go comma-separated. */
export function deploymentLogsQueryString(
  query: DeploymentLogsQuery & { mode?: "append" } = {},
): string {
  const params = new URLSearchParams();
  if (query.mode) params.set("mode", query.mode);
  if (query.startTime) params.set("startTime", query.startTime);
  if (query.endTime) params.set("endTime", query.endTime);
  if (query.direction) params.set("direction", query.direction);
  if (query.limit) params.set("limit", String(query.limit));
  setList(params, "type", query.type);
  setList(params, "level", query.level);
  if (query.text) params.set("text", query.text);
  setList(params, "instance", query.instance);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/** One page of a target's logs, oldest to newest. */
export async function getDeploymentTargetLogs(
  projectId: string,
  targetId: string,
  query: DeploymentLogsQuery = {},
): Promise<DeploymentLogsResponse> {
  const raw = await request<Record<string, unknown>>(
    `${logsPath(projectId, targetId)}${deploymentLogsQueryString(query)}`,
  );
  return normalizeLogsResponse(raw ?? {});
}

/** Full URL (not just the path) for EventSource, which cannot use fetch's base-URL plumbing. */
export function getDeploymentTargetLogsStreamUrl(
  projectId: string,
  targetId: string,
  query: DeploymentLogsQuery & { mode?: "append" } = {},
): string {
  return `${getApiBaseUrl()}${logsPath(projectId, targetId)}/stream${deploymentLogsQueryString(query)}`;
}

export interface DeploymentLogStreamHandlers {
  onEvent: (event: DeploymentLogStreamEvent) => void;
  /**
   * `closed` is final: the browser gave up (an auth failure, say). A
   * transient drop reconnects by itself and is not reported, and the
   * reconnect's snapshot is merged like any other page.
   */
  onError: (reason: "closed" | "malformed") => void;
}

export interface DeploymentLogStream {
  close: () => void;
}

/**
 * The `mode=append` live tail: a snapshot of the newest page, then only the
 * lines that are new since. The session cookie rides along cross-origin.
 */
export function openDeploymentLogStream(
  projectId: string,
  targetId: string,
  query: DeploymentLogsQuery,
  handlers: DeploymentLogStreamHandlers,
): DeploymentLogStream {
  const source = new EventSource(
    getDeploymentTargetLogsStreamUrl(projectId, targetId, {
      ...query,
      mode: "append",
    }),
    { withCredentials: true },
  );

  source.onmessage = (message: MessageEvent<string>) => {
    let raw: unknown;
    try {
      raw = JSON.parse(message.data);
    } catch {
      handlers.onError("malformed");
      return;
    }
    if (!raw || typeof raw !== "object") {
      handlers.onError("malformed");
      return;
    }
    handlers.onEvent(normalizeStreamEvent(raw as Record<string, unknown>));
  };

  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) handlers.onError("closed");
  };

  return { close: () => source.close() };
}
