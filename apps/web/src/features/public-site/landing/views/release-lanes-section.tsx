import type { CSSProperties } from "react";
import { motion } from "framer-motion";

import { PipelineLogo } from "@/shared/layout/pipeline-logo";
import { cn } from "@/shared/ui/cn";

const RELEASE_STEPS = [
  {
    num: "01",
    label: "Connect target",
    detail: "Connect release targets in settings. AlphaCI keeps release configuration encrypted and attached to the workspace.",
  },
  {
    num: "02",
    label: "Generate workflow",
    detail: "AlphaCI reads your stack, selects a source-backed template, and outputs a GitHub Actions YAML file.",
  },
  {
    num: "03",
    label: "Provision env vars",
    detail: "Environment variables are attached to the release lane automatically during the pipeline run.",
  },
  {
    num: "04",
    label: "Deploy fires on merge",
    detail: "Merge to your target branch and the release step runs through the governed production lane.",
  },
];

const RELEASE_LANES = [
  {
    key: "production",
    labelTone: "neutral",
    title: "Production lane",
    badge: "release production",
    method: "production_lane_ready",
    features: [
      "Token-based authentication",
      "Env vars provisioned per project",
      "Team ID support",
      "Staged production deploys",
    ],
  },
  {
    key: "review",
    labelTone: "accent",
    title: "Review lane",
    badge: "review gated",
    method: "review_lane_ready",
    features: [
      "Branch-connected release lane",
      "Service type + region config",
      "Env vars injected automatically",
      "Multiple release methods",
    ],
  },
];

const styles = {
  section: "relative overflow-hidden bg-[var(--bg-soft)] px-[clamp(2rem,7vw,8rem)] py-[clamp(4rem,6vw,6rem)]",
  ambient:
    "pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(52,211,153,0.05)_0%,transparent_65%)]",
  header: "relative z-10 mx-auto mb-[clamp(2.5rem,4vw,4rem)] max-w-[600px] text-center",
  eyebrow:
    "mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3.5 py-1.5 font-mono text-[0.78rem] font-bold uppercase tracking-[0.12em] text-emerald-400",
  eyebrowDot: "size-[5px] shrink-0 rounded-full bg-emerald-400",
  heading:
    "mb-4 mt-2 text-[clamp(1.8rem,3vw,2.8rem)] font-extrabold leading-tight tracking-normal text-[var(--text-primary)]",
  intro: "mx-auto my-0 max-w-[50ch] text-[clamp(0.9rem,1.2vw,1.05rem)] leading-[1.7] text-[var(--text-secondary)]",
  providersRow:
    "relative z-10 mx-auto mb-[clamp(2.5rem,4vw,4rem)] grid max-w-[840px] grid-cols-2 gap-[clamp(1.25rem,2.5vw,2rem)] max-[640px]:grid-cols-1",
  providerCard:
    "relative overflow-hidden rounded-[18px] p-[clamp(1.5rem,2.5vw,2rem)] transition-[border-color,box-shadow,transform] duration-200 ease-in-out hover:-translate-y-1",
  providerCardProduction:
    "border border-white/10 bg-[#08080a]/85 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.03)] hover:border-white/20 hover:shadow-[0_28px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1),0_0_40px_rgba(255,255,255,0.04)]",
  providerCardReview:
    "border border-emerald-400/20 bg-[#06100e]/85 shadow-[0_20px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(52,211,153,0.06),0_0_0_1px_rgba(52,211,153,0.03)] hover:border-emerald-400/30 hover:shadow-[0_28px_80px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(52,211,153,0.1),0_0_40px_rgba(52,211,153,0.06)]",
  grain:
    "pointer-events-none absolute inset-0 rounded-[inherit] bg-[length:128px_128px] opacity-[0.035]",
  cardHeader: "relative flex items-center gap-3 mb-5",
  providerLogo: "inline-flex size-11 shrink-0 items-center justify-center rounded-[10px]",
  providerLogoProduction: "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.12)]",
  providerLogoReview: "border border-emerald-400/25 bg-emerald-400/10 text-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.15)]",
  cardMeta: "m-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/40",
  cardMetaReview: "text-emerald-400/50",
  cardTitle: "m-0 text-[1rem] font-bold tracking-normal text-white",
  cardTitleReview: "text-emerald-400",
  badge: "ml-auto inline-flex items-center rounded-md px-[0.55rem] py-[0.18rem] font-mono text-[0.62rem] font-bold tracking-[0.04em]",
  badgeProduction: "bg-white/[0.08] text-white/70",
  badgeReview: "border border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
  featureList: "relative m-0 flex list-none flex-col gap-[0.55rem] p-0",
  featureItem: "flex items-center gap-2.5 text-[0.82rem] text-white/60",
  featureItemReview: "text-white/55",
  featureDot: "size-1 shrink-0 rounded-full bg-white opacity-50",
  featureDotReview: "bg-emerald-400 opacity-60",
  method: "relative mt-6 flex items-center gap-2.5 border-t border-white/[0.07] pt-4",
  methodReview: "border-emerald-400/10",
  methodLabel: "font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-white/35",
  methodLabelReview: "text-emerald-400/45",
  methodCode: "rounded-md bg-white/[0.07] px-2.5 py-1 font-mono text-[0.8rem] font-semibold tracking-[0.02em] text-white/85",
  methodCodeReview: "bg-emerald-400/10 text-emerald-300",
  stepsContainer: "relative z-10 mx-auto mt-20 max-w-[1200px] px-4",
  timelineLineBase: "absolute left-[12%] right-[12%] top-[2.25rem] h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent max-[960px]:hidden",
  timelineLineGlow: "absolute left-[12%] right-[12%] top-[2.25rem] h-[2px] bg-[linear-gradient(to_right,transparent,var(--brand),var(--brand-accent),transparent)] opacity-60 blur-[3px] max-[960px]:hidden",
  stepsGrid: "relative grid grid-cols-4 gap-6 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1",
  stepCardWrap: "relative flex flex-col",
  stepNodeWrap: "relative mx-auto mb-6 flex size-[4.5rem] items-center justify-center rounded-full border border-[#4f8eff]/40 bg-[#09090b] shadow-[0_0_30px_rgba(79,142,255,0.35)]",
  stepNodeInner: "relative flex size-[3.2rem] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-strong),var(--brand))] shadow-[0_0_15px_rgba(37,99,235,0.7)]",
  stepNum: "font-mono text-[1rem] font-black tracking-wider text-[#09090b]",
  stepCard: "group relative flex-1 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0d0d11]/60 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-[#4f8eff]/40 hover:bg-[#0d0d11]/80 shadow-[0_15px_30px_rgba(0,0,0,0.4)] text-center",
  stepCardGlow: "absolute -top-10 left-1/2 -z-10 size-32 -translate-x-1/2 rounded-full bg-[var(--brand)] opacity-20 blur-[50px] transition-opacity duration-500 group-hover:opacity-40",
  stepLabel: "mb-3 m-0 text-[1.15rem] font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]",
  stepDetail: "m-0 text-[0.85rem] leading-[1.65] text-white/70",
};
const grainStyle: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
};
type ReleaseLanesSectionProps = Readonly<{
  reduced: boolean | null;
}>;

export function ReleaseLanesSection({ reduced }: ReleaseLanesSectionProps) {
  return (
    <section id="deploy" className={styles.section} data-release-lanes-section="true" aria-label="Release lanes">
      <div className={styles.ambient} aria-hidden="true" />
      <ReleaseLanesHeader reduced={reduced} />
      <ReleaseLaneProviders reduced={reduced} />
      <ReleaseSteps reduced={reduced} />
    </section>
  );
}

function ReleaseLanesHeader({ reduced }: ReleaseLanesSectionProps) {
  return (
      <motion.div
        className={styles.header}
        initial={reduced ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.45 }}
      >
        <div className={styles.eyebrow}>
          <motion.span
            className={styles.eyebrowDot}
            data-paused={reduced ? "true" : undefined}
            aria-hidden="true"
            animate={reduced ? undefined : { opacity: [1, 0.55, 1], scale: [1, 1.45, 1] }}
            transition={reduced ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <span>Release lanes &middot; coming soon</span>
        </div>
        <h2 className={styles.heading}>Governed release lanes, coming with cloud hosting</h2>
        <p className={styles.intro}>Cloud (GCP) hosting is on the way. Until then, Solo Basic keeps your code tested, secured, and ready to release.</p>
      </motion.div>
  );
}

function ReleaseLaneProviders({ reduced }: ReleaseLanesSectionProps) {
  return (
      <motion.div
        className={styles.providersRow}
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, delay: 0.1 }}
      >
        {RELEASE_LANES.map((lane) => (
          <ReleaseLaneCard key={lane.key} lane={lane} />
        ))}
      </motion.div>
  );
}

function ReleaseLaneCard({ lane }: Readonly<{ lane: (typeof RELEASE_LANES)[number] }>) {
  const isReview = lane.key === "review";

  return (
            <div
              key={lane.key}
              className={cn(styles.providerCard, isReview ? styles.providerCardReview : styles.providerCardProduction)}
              data-release-lane-card="true"
            >
              <div aria-hidden="true" className={styles.grain} style={grainStyle} />
              <div className={styles.cardHeader}>
                <span className={cn(styles.providerLogo, isReview ? styles.providerLogoReview : styles.providerLogoProduction)} aria-hidden="true">
                  <PipelineLogo size={18} />
                </span>
                <div>
                  <p className={cn(styles.cardMeta, isReview && styles.cardMetaReview)}>Lane</p>
                  <p className={cn(styles.cardTitle, isReview && styles.cardTitleReview)}>{lane.title}</p>
                </div>
                <span className={cn(styles.badge, isReview ? styles.badgeReview : styles.badgeProduction)}>{lane.badge}</span>
              </div>

              <ul className={styles.featureList}>
                {lane.features.map((item) => (
                  <li key={item} className={cn(styles.featureItem, isReview && styles.featureItemReview)}>
                    <span className={cn(styles.featureDot, isReview && styles.featureDotReview)} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className={cn(styles.method, isReview && styles.methodReview)}>
                <span className={cn(styles.methodLabel, isReview && styles.methodLabelReview)}>Method</span>
               <code className={cn(styles.methodCode, isReview && styles.methodCodeReview)}>{lane.method}</code>
             </div>
            </div>
  );
}

function ReleaseSteps({ reduced }: ReleaseLanesSectionProps) {
  return (
      <div className={styles.stepsContainer}>
        <div className={styles.timelineLineBase} aria-hidden="true" />
        <div className={styles.timelineLineGlow} aria-hidden="true" />

        {/* Animated Energy Beam */}
        <motion.div
          className="absolute top-[2.25rem] h-[2px] w-[15%] bg-gradient-to-r from-transparent via-blue-400 to-transparent blur-[2px] max-[960px]:hidden"
          animate={reduced ? undefined : { left: ["10%", "85%", "10%"] }}
          transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />

        <motion.div
          className={styles.stepsGrid}
          initial={reduced ? undefined : { opacity: 0, y: 20 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {RELEASE_STEPS.map((step, index) => (
            <ReleaseStepCard key={step.num} step={step} index={index} reduced={reduced} />
          ))}
        </motion.div>
      </div>
  );
}

function ReleaseStepCard({
  step,
  index,
  reduced,
}: Readonly<{
  step: (typeof RELEASE_STEPS)[number];
  index: number;
  reduced: boolean | null;
}>) {
  return (
            <motion.div
              key={step.num}
              className={styles.stepCardWrap}
              initial={reduced ? undefined : { opacity: 0, y: 30 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Top Glowing Node with Pulsing Effect */}
              <div className={styles.stepNodeWrap} aria-hidden="true">
                <motion.div
                  className={styles.stepNodeInner}
                  animate={reduced ? undefined : {
                    boxShadow: ["0 0 15px rgba(37,99,235,0.35)", "0 0 32px rgba(37,99,235,0.65)", "0 0 15px rgba(37,99,235,0.35)"]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: index * 0.5 }}
                >
                  <span className={styles.stepNum}>{step.num}</span>
                </motion.div>
              </div>

              {/* Card */}
              <div className={styles.stepCard}>
                {/* Breathing Inner Glow */}
                <motion.div
                  className={styles.stepCardGlow}
                  aria-hidden="true"
                  animate={reduced ? undefined : {
                    opacity: [0.15, 0.35, 0.15],
                    scale: [1, 1.25, 1],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
                />

                {/* Glass Shimmer Sweep */}
                <motion.div
                  className="absolute inset-0 -z-10 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                  animate={reduced ? undefined : { translateX: ["-100%", "200%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 3 + index * 0.5 }}
                  aria-hidden="true"
                />

                <h3 className={styles.stepLabel}>{step.label}</h3>
                <p className={styles.stepDetail}>{step.detail}</p>
              </div>
            </motion.div>
  );
}

