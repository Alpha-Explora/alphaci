/* FlowBackground — dark ambient glow layer for the dark theme */
export function FlowBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Top-right brand-blue orb */}
      <div style={{
        position: "absolute",
        top: "-15%",
        right: "-8%",
        width: "55%",
        height: "65%",
        background: "radial-gradient(ellipse at center, rgba(79,142,255,0.07) 0%, transparent 68%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }} />
      {/* Bottom-left green accent orb */}
      <div style={{
        position: "absolute",
        bottom: "-12%",
        left: "-6%",
        width: "48%",
        height: "58%",
        background: "radial-gradient(ellipse at center, rgba(0,208,132,0.05) 0%, transparent 68%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }} />
      {/* Center subtle glow */}
      <div style={{
        position: "absolute",
        top: "35%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "40%",
        height: "40%",
        background: "radial-gradient(ellipse at center, rgba(79,142,255,0.03) 0%, transparent 70%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }} />
    </div>
  );
}
