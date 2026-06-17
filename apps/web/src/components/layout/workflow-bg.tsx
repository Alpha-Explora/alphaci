"use client";

import { motion, useReducedMotion } from "framer-motion";

/* ── Layout ─────────────────────────────────────────────────────────────────
   SVG viewBox 1200 x 560.
   Nodes placed diagonally so the graph fills the hero background.
   Two parallel branches (Lint + Test) merge back into Build.
──────────────────────────────────────────────────────────────────────────── */

interface WfNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  active?: boolean;
}

interface WfEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
  duration: number;
}

const NODES: WfNode[] = [
  { id: "source",   x:  60, y: 250, w: 110, h: 40, label: "Source"   },
  { id: "lint",     x: 240, y: 170, w: 100, h: 40, label: "Lint"     },
  { id: "test",     x: 240, y: 330, w: 100, h: 40, label: "Test"     },
  { id: "build",    x: 440, y: 250, w: 110, h: 40, label: "Build"    },
  { id: "security", x: 640, y: 170, w: 120, h: 40, label: "Security" },
  { id: "docker",   x: 640, y: 330, w: 120, h: 40, label: "Docker"   },
  { id: "deploy",   x: 870, y: 250, w: 120, h: 40, label: "Deploy",  active: true },
  { id: "notify",   x:1060, y: 175, w: 110, h: 40, label: "Notify"   },
  { id: "monitor",  x:1060, y: 325, w: 110, h: 40, label: "Monitor"  },
];

function nr(n: WfNode) { return { x: n.x + n.w, y: n.y + n.h / 2 }; }
function nl(n: WfNode) { return { x: n.x,       y: n.y + n.h / 2 }; }

function buildEdges(): WfEdge[] {
  const get = (id: string) => NODES.find((n) => n.id === id)!;
  const pairs: [string, string, number, number][] = [
    ["source",   "lint",     0.0, 2.2],
    ["source",   "test",     0.3, 2.4],
    ["lint",     "build",    0.5, 2.0],
    ["test",     "build",    0.7, 2.1],
    ["build",    "security", 1.0, 2.3],
    ["build",    "docker",   1.2, 2.5],
    ["security", "deploy",   1.5, 2.2],
    ["docker",   "deploy",   1.7, 2.0],
    ["deploy",   "notify",   2.0, 2.1],
    ["deploy",   "monitor",  2.2, 2.4],
  ];
  return pairs.map(([a, b, delay, duration]) => {
    const from = nr(get(a));
    const to   = nl(get(b));
    return { id: `${a}-${b}`, x1: from.x, y1: from.y, x2: to.x, y2: to.y, delay, duration };
  });
}

const EDGES = buildEdges();

/* ── Particle travelling along an edge ─────────────────────────────────────
   Uses CSS `offset-path` with a straight-line path so the circle travels
   from the source node's right edge to the target node's left edge.
──────────────────────────────────────────────────────────────────────────── */

function TravelParticle({ edge }: Readonly<{ edge: WfEdge }>) {
  const pathD = `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`;

  return (
    <motion.circle
      r={3.5}
      fill="rgba(56, 189, 248, 0.85)"
      filter="url(#particleGlow)"
      style={{ offsetPath: `path("${pathD}")` } as React.CSSProperties}
      initial={{ offsetDistance: "0%" }}
      animate={{ offsetDistance: ["0%", "100%"] }}
      transition={{
        duration: edge.duration,
        delay:    edge.delay,
        repeat:   Infinity,
        repeatDelay: 1.4,
        ease: "easeInOut",
      }}
      aria-hidden="true"
    />
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */

export function WorkflowBg() {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        maskImage:
          "radial-gradient(ellipse 90% 80% at 55% 50%, black 30%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 90% 80% at 55% 50%, black 30%, transparent 75%)",
        opacity: 0.7,
      }}
    >
      <svg
        viewBox="0 0 1200 560"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", opacity: 0.095 }}
      >
        <defs>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="particleGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connector lines */}
        {EDGES.map((edge) => (
          <line
            key={edge.id}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth={1.5}
            strokeDasharray="6 5"
          />
        ))}

        {/* Nodes */}
        {NODES.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={7}
              fill={node.active ? "rgba(52,211,153,0.14)" : "rgba(56,189,248,0.08)"}
              stroke={node.active ? "rgba(52,211,153,0.55)" : "rgba(56,189,248,0.35)"}
              strokeWidth={1.5}
              filter={node.active ? "url(#nodeGlow)" : undefined}
            />
            <text
              x={node.x + node.w / 2}
              y={node.y + node.h / 2 + 4.5}
              textAnchor="middle"
              fontSize={12}
              fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
              fontWeight={600}
              fill={
                node.active
                  ? "rgba(52,211,153,0.95)"
                  : "rgba(56,189,248,0.85)"
              }
              letterSpacing="0.04em"
            >
              {node.label}
            </text>
          </g>
        ))}

        {/* Animated particles — suppressed when prefers-reduced-motion is set */}
        {!reduced &&
          EDGES.map((edge) => <TravelParticle key={edge.id} edge={edge} />)}
      </svg>
    </div>
  );
}
