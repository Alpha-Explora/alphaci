"use client";

import type { WorkflowFileMetadata } from "@/features/projects";

export function WorkflowStageList({
  files,
}: Readonly<{ files?: WorkflowFileMetadata[] | null }>) {
  if (!files?.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <p
        style={{
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          margin: 0,
          fontWeight: 700,
        }}
      >
        {files.length} gated workflow stages
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {files.map((file) => (
          <WorkflowStageRow key={file.path} file={file} />
        ))}
      </div>
    </div>
  );
}

function WorkflowStageRow({ file }: Readonly<{ file: WorkflowFileMetadata }>) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "baseline",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: "0.76rem",
          color: "var(--text-primary)",
          fontWeight: 700,
        }}
      >
        {file.name}
      </span>
      <code
        style={{
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          wordBreak: "break-all",
        }}
      >
        {file.path}
      </code>
    </div>
  );
}
