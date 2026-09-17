"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useTransform } from "framer-motion";
import type { MotionValue, Variants } from "framer-motion";

import { DitherBackground } from "@/shared/layout/dither-background";
import { PipelineLogo } from "@/shared/layout/pipeline-logo";
import { cn } from "@/shared/ui/cn";

const heroStyles: Record<string, string> = {
  section:
    "relative grid min-h-screen grid-cols-2 content-center items-center gap-16 overflow-hidden bg-[var(--bg-soft)] px-[clamp(2rem,7vw,8rem)] pb-16 pt-28 max-[640px]:block max-[640px]:min-h-0 max-[640px]:px-4 max-[640px]:pb-12 max-[640px]:pt-[7.25rem]",
  background: "pointer-events-none absolute inset-0 opacity-[0.08]",
  massiveText: "!hidden",
  content: "relative z-10 col-start-1 col-end-2 row-start-1 row-end-2 text-left max-[640px]:max-w-full max-[640px]:!transform-none",
  kicker:
    "mb-[1.8rem] inline-flex items-center gap-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.24em] text-[var(--brand)]",
  kickerDot: "size-[0.42rem] rounded-full bg-[var(--brand)] shadow-[0_0_16px_color-mix(in_srgb,var(--brand)_72%,transparent)]",
  title:
    "mb-3 mt-0 text-[clamp(2.25rem,4vw,4rem)] font-extrabold leading-[1.05] tracking-normal text-[var(--text-primary)] max-[640px]:text-[clamp(2.6rem,13vw,3.6rem)] max-[640px]:leading-[1.02]",
  titleAccent: "text-[var(--brand)]",
  description:
    "mb-10 mt-0 max-w-[480px] text-[clamp(0.95rem,1.5vw,1.15rem)] leading-[1.7] text-[var(--text-secondary)] max-[640px]:max-w-[21rem] max-[640px]:font-[var(--font-dash-body)] max-[640px]:text-[1rem] max-[640px]:leading-[1.65] max-[640px]:text-[#c2c2c9]",
  actions: "flex gap-4 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:[&_a]:w-full",
  primaryAction:
    "inline-flex min-h-12 items-center justify-center rounded-full border-0 bg-[var(--text-primary)] px-8 py-[0.9rem] text-[0.8rem] font-bold uppercase leading-none tracking-[0.1em] text-[#09090b] no-underline transition-[background,border-color,transform] duration-200 ease-in-out hover:-translate-y-px",
  secondaryAction:
    "inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-8 py-[0.9rem] text-[0.8rem] font-bold uppercase leading-none tracking-[0.1em] text-[var(--text-primary)] no-underline backdrop-blur-[10px] transition-[background,border-color,transform] duration-200 ease-in-out hover:-translate-y-px",
  proofStrip: "mt-4 flex flex-wrap gap-[0.55rem] max-[640px]:mb-[1.6rem]",
  proofItem:
    "inline-flex min-h-[1.55rem] items-center gap-[0.42rem] whitespace-nowrap rounded-lg border border-zinc-400/20 bg-[#101014]/70 px-[0.62rem] py-[0.32rem] font-mono text-[0.68rem] leading-none text-[#c2c2c9]",
  proofDot: "size-[0.34rem] rounded-full bg-[var(--brand-accent)] shadow-[0_0_10px_rgba(106,168,255,0.62)]",
  stats: "mt-12 flex gap-12 border-t border-white/25 pt-8 max-[640px]:!hidden",
  stat: "min-w-0",
  statValue: "block text-[1.8rem] font-extrabold leading-none",
  statValueDefault: "text-[var(--text-primary)]",
  statValueBrand: "text-[var(--brand)] [text-shadow:0_0_20px_color-mix(in_srgb,var(--brand)_30%,transparent)]",
  statValueAccent: "text-[var(--brand-accent)] [text-shadow:0_0_20px_rgba(106,168,255,0.3)]",
  statLabel: "font-mono text-[0.65rem] uppercase tracking-[0.15em] text-[var(--text-muted)]",
  visual: "relative z-10 col-start-2 col-end-3 row-start-1 row-end-2 mt-8 max-[640px]:!hidden",
  floatingCard: "absolute border border-white/10 bg-zinc-900/85 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl",
  stageCard: "absolute -left-6 -top-5 z-30 min-w-40 rounded-[14px] border border-white/10 bg-zinc-900/85 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl",
  floatCardLabel: "mb-[0.6rem] font-mono text-[0.55rem] uppercase tracking-[0.15em] text-[var(--text-muted)]",
  stageRow: "mb-[0.35rem] flex items-center gap-2",
  stageDot: "size-[7px] shrink-0 rounded-full bg-[var(--stage-color)] shadow-[0_0_6px_var(--stage-color)]",
  stageTextDone: "font-mono text-[0.72rem] font-semibold text-[var(--text-secondary)]",
  stageTextActive: "font-mono text-[0.72rem] font-semibold text-[var(--text-primary)]",
  stageStateDone: "ml-auto text-[0.62rem] font-bold text-emerald-400",
  stageStateActive: "ml-auto text-[0.62rem] font-bold text-[var(--brand)]",
  mainCard: "relative z-10 overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0f0f12]/70 p-7 shadow-[0_32px_96px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_color-mix(in_srgb,var(--brand)_5%,transparent)] backdrop-blur-[28px]",
  cardAccent: "pointer-events-none absolute left-[10%] right-[10%] top-0 h-px rounded-[1px] bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--brand)_50%,transparent),rgba(52,211,153,0.3),transparent)]",
  cardGlow: "pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,color-mix(in_srgb,var(--brand)_9%,transparent)_0%,transparent_70%)]",
  terminalBar: "relative z-[1] mb-5 flex items-center gap-2",
  dotRed: "size-2 rounded-full bg-red-500 opacity-80",
  dotYellow: "size-2 rounded-full bg-yellow-500 opacity-80",
  dotGreen: "size-2 rounded-full bg-green-500 opacity-80",
  terminalBrand: "inline-flex items-center gap-1 rounded-md font-mono text-[0.62rem] font-bold text-[var(--text-secondary)]",
  branchChip: "ml-2 inline-flex items-center gap-1 rounded-md border border-blue-400/20 bg-blue-400/[0.08] px-2 py-[0.15rem] font-mono text-[0.62rem] font-bold text-[var(--brand)]",
  passingBadge: "ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-[0.15rem] font-mono text-[0.62rem] font-bold text-emerald-400",
  passingDot: "size-1 rounded-full bg-emerald-400",
  commitHash: "font-mono text-[0.6rem] text-[var(--text-muted)]",
  fileName: "font-mono text-[0.65rem] tracking-[0.05em] text-[var(--text-muted)]",
  codeBlock: "relative z-[1]",
  codeLine: "mb-[0.35rem] flex gap-2 rounded font-mono text-[0.76rem] leading-[1.75]",
  codeLineIndent: "pl-6",
  codeLineHighlight: "-mx-[0.4rem] bg-blue-400/[0.05] py-[0.1rem] pl-[1.9rem] pr-[0.4rem]",
  codeKey: "text-[var(--brand)]",
  codeKeyHighlight: "text-[var(--brand-accent)]",
  codeColon: "text-[var(--text-muted)]",
  codeValue: "text-[var(--text-secondary)]",
  codeValueHighlight: "text-[var(--brand-accent)]",
  progressBlock: "relative z-[1] mb-3 mt-5",
  progressLabelRow: "mb-[0.35rem] flex justify-between font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--text-muted)]",
  progressPercent: "font-bold text-[var(--brand)]",
  progressTrack: "h-0.5 overflow-hidden rounded-full bg-white/[0.05]",
  progressFill: "h-full rounded-full bg-[linear-gradient(90deg,var(--brand),var(--brand-accent))] shadow-[0_0_8px_color-mix(in_srgb,var(--brand)_40%,transparent)]",
  deployRow: "relative z-[1] mb-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2",
  deployLabel: "font-mono text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]",
  deployTarget: "ml-auto inline-flex items-center gap-[0.35rem]",
  deployIcon: "text-[var(--text-primary)] opacity-85",
  deployName: "font-mono text-[0.72rem] text-[var(--text-primary)]",
  deployEnv: "text-[0.62rem] not-italic text-[var(--text-muted)]",
  statusBar: "relative z-[1] flex origin-left items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-[0.55rem]",
  statusDot: "size-[5px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  statusText: "font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-emerald-400",
  liveBadge: "absolute -right-4 -top-4 z-20 flex items-center gap-[0.4rem] rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-[0.6rem] backdrop-blur-xl",
  liveDot: "size-[5px] rounded-full bg-[var(--brand)]",
  liveText: "font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--brand)]",
  metricCard: "absolute -bottom-6 -left-8 z-20 rounded-[14px] border border-white/[0.08] bg-zinc-900/85 px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl",
  metricRow: "mb-[0.4rem] flex items-baseline gap-[0.4rem]",
  metricValue: "text-2xl font-extrabold text-[var(--text-primary)]",
  metricDelta: "text-[0.7rem] font-bold text-emerald-400",
  laneSplit: "mb-2 flex gap-2 font-mono text-[0.58rem] text-[var(--text-muted)]",
  laneStrong: "text-[var(--brand)]",
  laneStrongAccent: "text-emerald-400",
  sparkline: "flex h-[22px] items-end gap-[3px]",
  sparklineBar: "w-1.5 origin-bottom rounded-sm bg-blue-400/30",
  sparklineAccent: "bg-[var(--brand-accent)]",
};

type HeroSectionProps = Readonly<{
  reduced: boolean | null;
  primaryHref: string;
  primaryLabel: string;
  pageScrollYProgress: MotionValue<number>;
}>;

const stageStatuses = [
  { label: "Lint", color: "#34d399", done: true },
  { label: "Test", color: "#34d399", done: true },
  { label: "Build", color: "var(--brand)", done: false },
];

const proofItems = ["GitHub App", "test to uat to main", "Automated security & tests"];


const codeLines = [
  { indent: 0, key: "name", value: "alphaci-ci", delay: 0.8, highlight: false },
  { indent: 0, key: "trigger", value: "push to uat", delay: 1, highlight: false },
  { indent: 0, key: "steps", value: "", delay: 1.2, highlight: false },
  { indent: 1, key: "checkout", value: "v4", delay: 1.4, highlight: false },
  { indent: 1, key: "install", value: "npm ci", delay: 1.6, highlight: false },
  { indent: 1, key: "lint", value: "eslint .", delay: 1.8, highlight: false },
  { indent: 1, key: "typecheck", value: "tsc --noEmit", delay: 2, highlight: false },
  { indent: 1, key: "test", value: "vitest run", delay: 2.2, highlight: false },
  { indent: 1, key: "audit", value: "deps + license", delay: 2.4, highlight: true },
];

const heroEase: [number, number, number, number] = [0.25, 1, 0.5, 1];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};


const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: heroEase } },
};

export function HeroSection({ reduced, primaryHref, primaryLabel, pageScrollYProgress }: HeroSectionProps) {
  const massiveTextOpacity = useTransform(pageScrollYProgress, [0, 1], [0.8, 0.2]);
  const massiveTextX = useTransform(pageScrollYProgress, [0, 1], ["0%", "-20%"]);
  const heroContentY = useTransform(pageScrollYProgress, [0, 1], [0, -150]);
  const dashboardY = useTransform(pageScrollYProgress, [0, 0.5], [0, -80]);

  return (
    <section className={heroStyles.section} aria-label="Main message" data-landing-hero-section="true">
      <DitherBackground className="hero-dither-background" />
      <div aria-hidden="true" className={heroStyles.background} />
      <motion.h1
        className={heroStyles.massiveText}
        aria-hidden="true"
        style={reduced ? { opacity: 0.8 } : { opacity: massiveTextOpacity, x: massiveTextX }}
      >
        ALPHACI ALPHACI ALPHACI
      </motion.h1>
      <HeroCopy
        reduced={reduced}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        heroContentY={heroContentY}
      />
      <HeroVisual reduced={reduced} dashboardY={dashboardY} />
    </section>
  );
}

type HeroCopyProps = Readonly<{
  reduced: boolean | null;
  primaryHref: string;
  primaryLabel: string;
  heroContentY: MotionValue<number>;
}>;

function HeroCopy({ reduced, primaryHref, primaryLabel, heroContentY }: HeroCopyProps) {
  return (
<motion.div
        className={heroStyles.content}
        style={reduced ? undefined : { y: heroContentY }}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.h1 variants={reduced ? undefined : fadeUp} className={heroStyles.title}>
          Ship governed<br />CI/CD from<br />one AlphaCI<br />
          <motion.span
            className={heroStyles.titleAccent}
            style={reduced ? { textShadow: "0 0 16px rgba(79,142,255,0.26)" } : undefined}
            animate={
              reduced
                ? undefined
                : {
                    textShadow: [
                      "0 0 0px rgba(79,142,255,0)",
                      "0 0 30px rgba(79,142,255,0.55)",
                      "0 0 16px rgba(79,142,255,0.26)",
                    ],
                  }
            }
            transition={reduced ? undefined : { duration: 1.5, delay: 1, ease: heroEase, times: [0, 0.55, 1] }}
          >
            workspace
          </motion.span>
        </motion.h1>

        <motion.p variants={reduced ? undefined : fadeUp} className={heroStyles.description}>
          Push code. AlphaCI tests it, secures it, and walks it from DEV to UAT to MAIN, zero YAML to write.
        </motion.p>

        <motion.div className={heroStyles.actions} variants={reduced ? undefined : fadeUp}>
          <Link className={heroStyles.primaryAction} href={primaryHref}>{primaryLabel}</Link>
          <Link className={heroStyles.secondaryAction} href="https://m.me/61581265528238" target="_blank" rel="noopener noreferrer">Contact Sales &gt;</Link>
        </motion.div>

        <motion.div className={heroStyles.proofStrip} variants={reduced ? undefined : fadeUp} aria-label="AlphaCI setup coverage">
          {proofItems.map((item) => (
            <span className={heroStyles.proofItem} key={item}>
              <span className={heroStyles.proofDot} aria-hidden="true" />
              {item}
            </span>
          ))}
        </motion.div>



        <motion.div className={heroStyles.stats} variants={reduced ? undefined : fadeUp}>
          <HeroStat value="10+" label="Environments" tone="default" />
          <HeroStat value="FE + BE" label="Repo support" tone="brand" />
        </motion.div>
      </motion.div>

    
  );
}

function HeroVisual({ reduced, dashboardY }: Readonly<{ reduced: boolean | null; dashboardY: MotionValue<number> }>) {
  return (
<motion.div
        className={heroStyles.visual}
        style={reduced ? undefined : { y: dashboardY }}
        initial={reduced ? undefined : { opacity: 0, x: 60, scale: 0.95 }}
        animate={reduced ? undefined : { opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.6, ease: heroEase }}
      >
        <StageCard reduced={reduced} />
        <MainPipelineCard reduced={reduced} />
        <PassingBadge reduced={reduced} />
      </motion.div>
  );
}

function HeroStat({ value, label, tone }: Readonly<{ value: string; label: string; tone: "default" | "brand" | "accent" }>) {
  const toneClass = {
    default: heroStyles.statValueDefault,
    brand: heroStyles.statValueBrand,
    accent: heroStyles.statValueAccent,
  }[tone];

  return (
    <div className={heroStyles.stat}>
      <span className={cn(heroStyles.statValue, toneClass)}>{value}</span>
      <span className={heroStyles.statLabel}>{label}</span>
    </div>
  );
}

function StageCard({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.div className={heroStyles.stageCard} initial={reduced ? undefined : { opacity: 0, x: -20, y: -10 }} animate={reduced ? undefined : { opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.6, delay: 2.2, ease: heroEase }}>
      <div className={heroStyles.floatCardLabel}>Pipeline stages</div>
      {stageStatuses.map((stage) => (
        <div key={stage.label} className={heroStyles.stageRow}>
          <PulseDot className={heroStyles.stageDot} paused={stage.done || reduced} style={{ "--stage-color": stage.color } as CSSProperties} />
          <span className={stage.done ? heroStyles.stageTextDone : heroStyles.stageTextActive}>{stage.label}</span>
          <span className={stage.done ? heroStyles.stageStateDone : heroStyles.stageStateActive}>{stage.done ? "OK" : "..."}</span>
        </div>
      ))}
    </motion.div>
  );
}

function MainPipelineCard({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <div className={heroStyles.mainCard}>
      <div aria-hidden="true" className={heroStyles.cardAccent} />
      <div aria-hidden="true" className={heroStyles.cardGlow} />
      <div className={heroStyles.terminalBar}>
        <span className={heroStyles.dotRed} aria-hidden="true" />
        <span className={heroStyles.dotYellow} aria-hidden="true" />
        <span className={heroStyles.dotGreen} aria-hidden="true" />
        <span className={heroStyles.terminalBrand}><PipelineLogo size={14} />AlphaCI run</span>
        <span className={heroStyles.branchChip}><BranchIcon />main</span>
        <span className={heroStyles.commitHash}>a3f9c12</span>
        <span className={heroStyles.passingBadge}><PulseDot className={heroStyles.passingDot} paused={reduced} />passing</span>
        <span className={heroStyles.fileName}>pipeline.yml</span>
      </div>

      <div className={heroStyles.codeBlock}>
        {codeLines.map((line) => <CodeLine key={line.key} line={line} reduced={reduced} />)}
      </div>

      <ProgressBlock reduced={reduced} />
      <motion.div className={heroStyles.statusBar} initial={reduced ? undefined : { opacity: 0, scaleX: 0 }} animate={reduced ? undefined : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.8, delay: 2.7, ease: heroEase }}>
        <span className={heroStyles.statusDot} aria-hidden="true" />
        <span className={heroStyles.statusText}>All checks passed - error free</span>
      </motion.div>
    </div>
  );
}

function CodeLine({ line, reduced }: Readonly<{ line: (typeof codeLines)[number]; reduced: boolean | null }>) {
  const indentClass = line.indent === 1 ? heroStyles.codeLineIndent : "";
  return (
    <motion.div
      className={`${heroStyles.codeLine} ${indentClass} ${line.highlight ? heroStyles.codeLineHighlight : ""}`}
      initial={reduced ? undefined : { opacity: 0, x: 20 }}
      animate={reduced ? undefined : { opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: line.delay, ease: heroEase }}
    >
      <span className={line.highlight ? heroStyles.codeKeyHighlight : heroStyles.codeKey}>{line.key}</span>
      {line.value && <span className={heroStyles.codeColon}>:</span>}
      {line.value && <span className={line.highlight ? heroStyles.codeValueHighlight : heroStyles.codeValue}>{line.value}</span>}
    </motion.div>
  );
}

function ProgressBlock({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.div className={heroStyles.progressBlock} initial={reduced ? undefined : { opacity: 0 }} animate={reduced ? undefined : { opacity: 1 }} transition={{ duration: 0.4, delay: 2.5 }}>
      <div className={heroStyles.progressLabelRow}>
        <span>Pipeline progress</span>
        <span className={heroStyles.progressPercent}>82%</span>
      </div>
      <div className={heroStyles.progressTrack}>
        <motion.div className={heroStyles.progressFill} initial={reduced ? undefined : { width: "0%" }} animate={reduced ? undefined : { width: "82%" }} transition={{ duration: 1.4, delay: 2.7, ease: heroEase }} />
      </div>
    </motion.div>
  );
}

function PassingBadge({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.div className={heroStyles.liveBadge} initial={reduced ? undefined : { opacity: 0, scale: 0.8, y: 20 }} animate={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, delay: 2.8, ease: heroEase }}>
      <PulseDot className={heroStyles.liveDot} paused={reduced} />
      <span className={heroStyles.liveText}>Passing</span>
    </motion.div>
  );
}


function PulseDot({ className, paused, style }: Readonly<{ className: string; paused: boolean | null; style?: CSSProperties }>) {
  return (
    <motion.span
      className={className}
      data-paused={paused ? "true" : undefined}
      style={style}
      aria-hidden="true"
      animate={paused ? undefined : { opacity: [0.55, 1, 0.55], scale: [1, 1.18, 1] }}
      transition={paused ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
function BranchIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
    </svg>
  );
}




