"use client";

import { useEffect, useRef, useState } from "react";

import type { DeploymentTarget } from "@/features/projects";
import type { RunGroup } from "@/features/runs";
import {
  getDeploymentTargetLogsStreamUrl,
  type DeploymentTargetLogsResponse,
} from "@/features/projects";

export interface LogLine {
  timestamp: string;
  message: string;
  level: string;
}

const TIME_RANGE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "15m", label: "Last 15 minutes" },
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
] as const;

const TIME_RANGE_MINUTES: Record<string, number> = {
  "15m": 15,
  "1h": 60,
  "6h": 6 * 60,
  "24h": 24 * 60,
};

function timeRangeToWindow(
  rangeValue: string,
): { startTime: string; endTime: string } | null {
  const minutes = TIME_RANGE_MINUTES[rangeValue];
  if (!minutes) return null;
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - minutes * 60_000);
  return { startTime: startTime.toISOString(), endTime: endTime.toISOString() };
}

export function ServiceLogsConsole({
  projectId,
  target,
  latestRun,
}: Readonly<{
  projectId: string;
  target: DeploymentTarget;
  latestRun?: RunGroup;
}>) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [source, setSource] = useState<"live" | "simulated" | null>(null);
  const [simulatedReason, setSimulatedReason] = useState<string | null>(null);
  const [logType, setLogType] = useState("");
  const [timeRange, setTimeRange] = useState<string>("");
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Live tail via SSE: the backend pushes a fresh snapshot on its own
  // interval instead of the browser re-polling over plain HTTP. The
  // connection is recreated whenever a filter changes, since EventSource
  // can't change its URL once open — each recreation re-evaluates the
  // time-range window against "now" at that moment.
  useEffect(() => {
    setLoading(true);
    setError(null);

    const url = getDeploymentTargetLogsStreamUrl(projectId, target.id, {
      ...(logType ? { type: logType } : {}),
      ...(timeRangeToWindow(timeRange) ?? {}),
    });
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data) as DeploymentTargetLogsResponse;
        setLogs(res.logs);
        setSource(res.source);
        setSimulatedReason(
          res.source === "simulated" ? (res.reason ?? null) : null,
        );
        setError(null);
      } catch {
        setError("Received a malformed log update.");
      } finally {
        setLoading(false);
      }
    };

    eventSource.onerror = () => {
      // EventSource retries automatically unless the browser has fully
      // closed the connection (e.g. auth failure) — only surface an error
      // once retries have been exhausted, not on every transient blip.
      if (eventSource.readyState === EventSource.CLOSED) {
        setError("Live log connection closed. Reopen this panel to retry.");
        setLoading(false);
      }
    };

    return () => eventSource.close();
  }, [projectId, target.id, logType, timeRange]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const filteredLogs = logs.filter((log) =>
    log.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatHeaderDate = () => {
    return new Date().toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCommitText = () => {
    if (latestRun) {
      const sha = latestRun.commitSha?.slice(0, 7) || "";
      return `Run #${latestRun.runId} on ${latestRun.branch} (${sha})`;
    }
    return "Initial deployment";
  };

  return (
    <div
      className="glass-panel"
      style={{
        marginTop: "1.2rem",
        padding: "1.25rem 1.5rem",
        borderRadius: "var(--radius-card, 12px)",
        background: "rgba(10, 10, 12, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              {formatHeaderDate()}
            </span>
            {source === "simulated" ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "rgba(245, 158, 11, 0.1)",
                  color: "#fbbf24",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.1rem 0.45rem",
                  borderRadius: "1rem",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                }}
              >
                <span
                  style={{
                    width: "0.35rem",
                    height: "0.35rem",
                    borderRadius: "50%",
                    background: "#f59e0b",
                    display: "inline-block",
                  }}
                />
                Simulated
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "#34d399",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.1rem 0.45rem",
                  borderRadius: "1rem",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                <span
                  style={{
                    width: "0.35rem",
                    height: "0.35rem",
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                    boxShadow: "0 0 8px #10b981",
                  }}
                />
                Live
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: "0.78rem",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--text-muted)",
              textDecoration: "underline",
              cursor: "default",
            }}
          >
            {getCommitText()}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <select
            aria-label="Log type"
            value={logType}
            onChange={(e) => setLogType(e.target.value)}
            style={{
              background: "rgba(17, 17, 22, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "0.35rem",
              padding: "0.35rem 0.6rem",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              outline: "none",
            }}
          >
            <option value="">All logs</option>
            <option value="build">Build logs</option>
            <option value="app">App logs</option>
          </select>

          <select
            aria-label="Time range"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              background: "rgba(17, 17, 22, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "0.35rem",
              padding: "0.35rem 0.6rem",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              outline: "none",
            }}
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs"
            style={{
              background: "rgba(17, 17, 22, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "0.35rem",
              padding: "0.35rem 0.6rem",
              fontSize: "0.78rem",
              color: "var(--text-primary)",
              outline: "none",
              minWidth: "10rem",
            }}
          />

          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
              padding: "0.35rem 0.5rem",
              borderRadius: "0.35rem",
            }}
          >
            GMT+8
          </span>
        </div>
      </div>

      {source === "simulated" && simulatedReason ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.78rem",
            color: "#fbbf24",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
          }}
        >
          Showing simulated logs — {simulatedReason}
        </div>
      ) : null}

      <div
        style={{
          background: "rgba(10, 10, 12, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "8px",
          padding: "1rem",
          fontFamily: "var(--font-mono, Courier, monospace)",
          fontSize: "0.8rem",
          color: "rgba(255, 255, 255, 0.9)",
          lineHeight: "1.45",
          height: "22rem",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem",
        }}
      >
        {loading ? (
          <span style={{ color: "var(--text-muted)" }}>Loading log stream...</span>
        ) : error ? (
          <span style={{ color: "var(--danger)" }}>{error}</span>
        ) : filteredLogs.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>
            {searchQuery ? "No logs match search query" : "Console is empty"}
          </span>
        ) : (
          filteredLogs.map((log, idx) => {
            let rowColor = "inherit";
            let bgStyle = {};
            if (log.level === "warn") {
              rowColor = "#fbbf24";
              bgStyle = { background: "rgba(245, 158, 11, 0.05)", margin: "0 -0.5rem", padding: "0 0.5rem" };
            } else if (log.level === "error") {
              rowColor = "#f87171";
              bgStyle = { background: "rgba(239, 68, 68, 0.06)", margin: "0 -0.5rem", padding: "0 0.5rem" };
            } else if (log.level === "system") {
              rowColor = "#34d399";
            }

            let displayTime = "";
            try {
              const d = new Date(log.timestamp);
              displayTime = d.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            } catch {
              displayTime = log.timestamp;
            }

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                  ...bgStyle,
                }}
              >
                <span style={{ color: "var(--text-muted)", flexShrink: 0, userSelect: "none" }}>
                  {displayTime}
                </span>
                <span style={{ color: rowColor }}>{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          paddingTop: "0.25rem",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
        }}
      >
        <span>
          Need better ways to work with logs? Try the{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {target.provider === "render" ? "Render CLI, Render MCP Server" : "Vercel CLI, Vercel MCP Server"}
          </strong>
          , or set up a{" "}
          <span style={{ textDecoration: "underline", cursor: "pointer" }}>
            log stream integration
          </span>
        </span>
      </div>
    </div>
  );
}
