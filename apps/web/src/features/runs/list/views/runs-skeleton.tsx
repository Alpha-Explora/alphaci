"use client";

function SkeletonBlock({
  width = "100%",
  height = "1rem",
  radius = "0.4rem",
}: {
  width?: string;
  height?: string;
  radius?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: "var(--bg-elevated)",
        animation: "state-pulse 1.5s ease-in-out infinite",
        flexShrink: 0,
      }}
    />
  );
}

function SkeletonNode() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <SkeletonBlock width="48px" height="48px" radius="50%" />
      <SkeletonBlock width="40px" height="0.6rem" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="glass-panel"
      style={{ padding: "clamp(1.1rem, 2vw, 1.5rem)", display: "grid", gap: "1rem" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.6rem" }}>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <SkeletonBlock width="14rem" height="1rem" />
          <SkeletonBlock width="8rem" height="0.75rem" />
        </div>
        <SkeletonBlock width="5rem" height="1.5rem" radius="999px" />
      </div>

      {/* Pipeline row skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <SkeletonNode />
        <SkeletonBlock height="2px" radius="1px" />
        <SkeletonNode />
        <SkeletonBlock height="2px" radius="1px" />
        <SkeletonNode />
      </div>
    </div>
  );
}

export function RunsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading pipeline runs"
      style={{ display: "grid", gap: "1rem" }}
    >
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
