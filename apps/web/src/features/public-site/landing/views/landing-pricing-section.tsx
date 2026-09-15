"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { MorphingBlob } from "./landing-motion";
import { LANDING_PLACEHOLDER_PLANS, type LandingPlan } from "../model/landing-plans";
import { cn } from "@/shared/ui/cn";

type LandingPricingSectionProps = Readonly<{ reduced?: boolean | null }>;

const heroEase: [number, number, number, number] = [0.25, 1, 0.5, 1];

type PlanTone = "brand" | "violet" | "amber" | "accent";

const PLAN_TONE_BAR: Record<PlanTone, string> = {
  brand: "bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--brand)_60%,transparent),transparent)]",
  violet: "bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.55),transparent)]",
  amber: "bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.5),transparent)]",
  accent: "bg-[linear-gradient(90deg,transparent,rgba(52,211,153,0.6),transparent)]",
};

const styles = {
  section: "relative overflow-hidden bg-[var(--bg-soft)] px-[clamp(2rem,7vw,8rem)] py-[clamp(4rem,6vw,6rem)]",
  topGlow:
    "pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(79,142,255,0.06)_0%,transparent_65%)]",
  header: "relative z-[1] mx-auto mb-[clamp(1.5rem,2.5vw,2.5rem)] max-w-[56ch] text-center",
  badge:
    "mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_12%,transparent),rgba(52,211,153,0.08))] px-3.5 py-1.5",
  badgeDot: "size-[5px] rounded-full bg-[var(--brand-accent)]",
  badgeText: "font-mono text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[var(--brand)]",
  heading: "m-0 text-[clamp(2rem,3.5vw,3.2rem)] font-extrabold leading-[1.1] tracking-normal text-[var(--text-primary)]",
  description: "mx-auto mt-5 max-w-[48ch] text-[clamp(0.9rem,1.2vw,1.05rem)] leading-[1.7] text-[var(--text-secondary)]",
  
  tabsWrap: "relative z-20 mx-auto mb-12 flex w-fit rounded-full border border-white/10 bg-zinc-900/60 p-1.5 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
  tabBtn: "relative z-10 rounded-full px-8 py-3 text-[0.85rem] font-extrabold uppercase tracking-wider transition-colors duration-300",
  tabBtnActive: "text-[#09090b]",
  tabBtnInactive: "text-[var(--text-secondary)] hover:text-white",
  tabIndicator: "absolute inset-0 -z-10 rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-accent))] shadow-[0_4px_16px_color-mix(in_srgb,var(--brand)_40%,transparent)]",
  
  planGrid: "relative z-[1] grid grid-cols-3 items-stretch gap-[clamp(1rem,1.8vw,1.4rem)] max-[1020px]:grid-cols-1",
  planCard:
    "relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-7 backdrop-blur-md transition-[border-color,box-shadow,transform] duration-300 hover:border-blue-400/30 hover:shadow-[0_0_40px_color-mix(in_srgb,var(--brand)_8%,transparent)]",
  featuredCard:
    "border-blue-400/40 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--brand)_16%,transparent),transparent_16rem),linear-gradient(180deg,rgba(8,22,43,0.95),rgba(6,13,29,0.9))] shadow-[0_22px_70px_rgba(20,184,166,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]",
  featuredAccent:
    "absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent_0%,var(--brand)_30%,var(--brand-accent)_70%,transparent_100%)] bg-[length:200%_100%]",
  offerBadge:
    "absolute right-4 top-4 rounded-full border border-blue-400/30 bg-blue-400/10 px-[0.62rem] py-[0.28rem] font-mono text-[0.6rem] font-extrabold uppercase tracking-[0.08em] text-[var(--brand)]",
  trialBadge:
    "absolute right-4 top-4 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-[0.62rem] py-[0.28rem] font-mono text-[0.6rem] font-extrabold uppercase tracking-[0.08em] text-emerald-400",
  soonBadge:
    "absolute right-4 top-4 rounded-full border border-zinc-400/20 bg-zinc-400/[0.08] px-[0.62rem] py-[0.28rem] font-mono text-[0.6rem] font-extrabold uppercase tracking-[0.08em] text-zinc-400",
  planName: "m-0 text-[1.2rem] font-extrabold tracking-normal text-[var(--text-primary)]",
  planTagline: "m-0 min-h-[2.6rem] text-[0.85rem] leading-[1.6] text-[var(--text-secondary)]",
  useCaseRow: "m-0 flex min-h-[2.4rem] items-start gap-2 text-[0.78rem] leading-[1.5]",
  useCaseLabel: "mt-[0.1rem] shrink-0 font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--brand)]",
  useCaseText: "text-[var(--text-secondary)]",
  priceRow: "flex min-h-[2.6rem] items-baseline gap-[0.35rem]",
  priceValue: "text-[2rem] font-extrabold leading-none tracking-normal text-[var(--text-primary)]",
  priceValueSoon: "text-[1.3rem] font-bold leading-none text-[var(--text-muted)]",
  pricePeriod: "text-[0.8rem] not-italic text-[var(--text-muted)]",
  priceNote: "-mt-2 text-[0.75rem] leading-[1.4] text-[var(--brand-accent)]",
  featureList: "m-0 grid flex-1 list-none gap-[0.62rem] p-0",
  featureItem: "grid grid-cols-[1.1rem_minmax(0,1fr)] items-start gap-[0.55rem] text-[0.85rem] leading-[1.45]",
  featureIncluded: "text-zinc-200",
  featureExcluded: "text-zinc-500",
  whyBox: "rounded-xl border border-blue-400/15 bg-blue-400/[0.05] p-4",
  whyLabel: "mb-1 block font-mono text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--brand)]",
  whyText: "m-0 text-[0.82rem] leading-[1.55] text-[var(--text-secondary)]",
  primaryAction:
    "inline-flex min-h-12 w-full items-center justify-center rounded-full border-0 bg-[var(--text-primary)] px-8 py-[0.9rem] text-[0.78rem] font-bold uppercase leading-none tracking-[0.1em] text-[#09090b] no-underline",
  disabledAction:
    "inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full border border-zinc-400/15 bg-zinc-400/[0.06] px-8 py-[0.9rem] text-[0.78rem] font-bold uppercase leading-none tracking-[0.1em] text-zinc-400/70",
  footerRow: "relative z-[1] mt-10 flex justify-center",
  footerLink:
    "inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-9 py-[0.9rem] text-[0.8rem] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--text-primary)] no-underline backdrop-blur-[10px]",
};

export function LandingPricingSection({ reduced = false }: LandingPricingSectionProps) {
  const [activeTab, setActiveTab] = useState<"solo" | "business">("solo");
  const catalogPlans = LANDING_PLACEHOLDER_PLANS;
  const soloPlans = catalogPlans.filter((plan) => plan.id.startsWith("solo"));
  const businessPlans = catalogPlans.filter((plan) => !plan.id.startsWith("solo"));
  const activePlans = activeTab === "solo" ? soloPlans : businessPlans;

  return (
    <section id="pricing" className={styles.section} aria-label="Pricing plans" data-landing-pricing-section="true">
      <div className={styles.topGlow} aria-hidden="true" />
      <MorphingBlob reduced={reduced} tone="brand" className="left-[-160px] top-[20%] h-[420px] w-[500px]" />
      <MorphingBlob reduced={reduced} tone="accent" delay={11} className="right-[-140px] top-[45%] h-[380px] w-[460px]" />

      <motion.div
        className={styles.header}
        initial={reduced ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: heroEase }}
      >
        <div className={styles.badge}>
          <PulseDot className={styles.badgeDot} paused={reduced} />
          <span className={styles.badgeText}>Plans</span>
        </div>
        <h2 className={styles.heading}>Working solo or with a team? We have the solution for you.</h2>
        <p className={styles.description}>
          Ship your own projects with Solo today. AlphaCI Business comes next.
        </p>
      </motion.div>

      <div className={styles.tabsWrap}>
        {(["solo", "business"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(styles.tabBtn, activeTab === tab ? styles.tabBtnActive : styles.tabBtnInactive)}
            aria-pressed={activeTab === tab}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="activeTabIndicator"
                className={styles.tabIndicator}
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {tab === "solo" ? "Solo" : "Business"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          className={styles.planGrid}
          initial={reduced ? undefined : { opacity: 0, y: 15 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
        >
          {activePlans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} index={index} reduced={reduced} />
          ))}
        </motion.div>
      </AnimatePresence>

      <div className={styles.footerRow}>
        <motion.div whileHover={reduced ? undefined : { scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Link className={styles.footerLink} href="/signup">Compare all plans &rarr;</Link>
        </motion.div>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  index,
  reduced,
}: Readonly<{ plan: LandingPlan; index: number; reduced: boolean | null }>) {
  const tone = (["brand", "violet", "amber"] as const)[Math.min(index, 2)];
  const isAvailable = plan.status === "available";
  const ctaLabel = isAvailable ? `Start ${plan.name}` : "Coming soon";

  return (
    <motion.article
      className={cn(styles.planCard, plan.featured && styles.featuredCard)}
      data-plan-card={plan.name}
      initial={reduced ? undefined : { opacity: 0, y: 14 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: heroEase }}
      whileHover={reduced ? undefined : { y: -6 }}
    >
      <PlanAccent plan={plan} reduced={reduced} tone={tone} />
      <PlanBadge isAvailable={isAvailable} />
      <h3 className={styles.planName}>{plan.name}</h3>
      <p className={styles.planTagline}>{plan.tagline || plan.description}</p>
      <p className={styles.useCaseRow}>
        <span className={styles.useCaseLabel}>For</span>
        <span className={styles.useCaseText}>{plan.useCase}</span>
      </p>
      <PlanPrice plan={plan} />
      <PlanAction isAvailable={isAvailable} className={styles.primaryAction} label={ctaLabel} />
      <ul className={styles.featureList} aria-label={`${plan.name} features`}>
        {plan.features.map((feature) => (
          <PlanFeature key={feature.label} feature={feature} />
        ))}
      </ul>
      <PlanWhy plan={plan} />
    </motion.article>
  );
}

function PlanAccent({
  plan,
  reduced,
  tone,
}: Readonly<{ plan: LandingPlan; reduced: boolean | null; tone: PlanTone }>) {
  return plan.featured ? (
    <FeaturedAccent reduced={reduced} />
  ) : (
    <div className={cn("absolute inset-x-0 top-0 h-0.5", PLAN_TONE_BAR[tone])} aria-hidden="true" />
  );
}

function PlanBadge({ isAvailable }: Readonly<{ isAvailable: boolean }>) {
  return (
    <span className={isAvailable ? styles.offerBadge : styles.soonBadge}>
      {isAvailable ? "Available now" : "Coming soon"}
    </span>
  );
}

function PlanPrice({ plan }: Readonly<{ plan: LandingPlan }>) {
  const className = plan.status === "available" ? styles.priceValue : styles.priceValueSoon;

  return (
    <>
      <div className={styles.priceRow}>
        <span className={className}>{plan.priceLabel}</span>
        {plan.periodLabel ? <em className={styles.pricePeriod}>{plan.periodLabel}</em> : null}
      </div>
      {plan.whyThisPlan ? <p className={styles.priceNote}>{plan.whyThisPlan}</p> : null}
    </>
  );
}

function PlanAction({
  isAvailable,
  className,
  label,
}: Readonly<{ isAvailable: boolean; className: string; label: string }>) {
  return isAvailable ? (
    <Link className={className} href="/signup">
      {label}
    </Link>
  ) : (
    <span className={styles.disabledAction} aria-disabled="true">Coming soon</span>
  );
}

function PlanFeature({
  feature,
}: Readonly<{ feature: LandingPlan["features"][number] }>) {
  return (
    <li className={cn(styles.featureItem, feature.included ? styles.featureIncluded : styles.featureExcluded)}>
      {feature.included ? <CheckIcon /> : <DashIcon />}
      <span>{feature.label}</span>
    </li>
  );
}

function PlanWhy({ plan }: Readonly<{ plan: LandingPlan }>) {
  return plan.whyThisPlan ? (
    <div className={styles.whyBox}>
      <span className={styles.whyLabel}>Why this plan?</span>
      <p className={styles.whyText}>{plan.whyThisPlan}</p>
    </div>
  ) : null;
}

function PulseDot({ className, paused }: Readonly<{ className: string; paused: boolean | null }>) {
  return (
    <motion.span
      className={className}
      data-paused={paused ? "true" : undefined}
      aria-hidden="true"
      animate={paused ? undefined : { opacity: [0.55, 1, 0.55], scale: [1, 1.18, 1] }}
      transition={paused ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function FeaturedAccent({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.div
      className={styles.featuredAccent}
      data-paused={reduced ? "true" : undefined}
      aria-hidden="true"
      animate={reduced ? undefined : { backgroundPosition: ["0% 0", "200% 0"] }}
      transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "linear" }}
    />
  );
}

function CheckIcon() {
  return (
    <svg className="mt-[0.15rem] size-[0.95rem] text-[var(--brand-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg className="mt-[0.15rem] size-[0.95rem] text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  );
}



