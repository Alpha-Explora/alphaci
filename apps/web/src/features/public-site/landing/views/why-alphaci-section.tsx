"use client";

import { motion } from "framer-motion";

import { MorphingBlob, ScenePhoto } from "./landing-motion";
import { cn } from "@/shared/ui/cn";

type WhyAlphaCISectionProps = Readonly<{ reduced?: boolean | null }>;

const heroEase: [number, number, number, number] = [0.25, 1, 0.5, 1];

type BenefitTone = "brand" | "accent" | "violet";

interface Benefit {
  title: string;
  body: string;
  tone: BenefitTone;
  icon: "clock" | "shield" | "people";
  /** Real photograph (Unsplash) — swap for your own shots anytime. */
  photo: string;
  photoAlt: string;
}

const BENEFITS: Benefit[] = [
  {
    title: "Ship in minutes, not meetings",
    body: "Point AlphaCI at your repo and get a working pipeline before your coffee cools.",
    tone: "brand",
    icon: "clock",
    photo: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&w=640&q=80",
    photoAlt: "Developer focused at her laptop",
  },
  {
    title: "Guardrails your whole team trusts",
    body: "Protected branches and a UAT gate come standard — everyone sees what shipped.",
    tone: "accent",
    icon: "shield",
    photo: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=640&q=80",
    photoAlt: "Team reviewing work together at a whiteboard",
  },
  {
    title: "Made for people, not just experts",
    body: "Juniors and students set up production-grade CI/CD on day one.",
    tone: "violet",
    icon: "people",
    photo: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=640&q=80",
    photoAlt: "Students working side by side on laptops",
  },
];

function BenefitGlyph({ icon }: Readonly<{ icon: Benefit["icon"] }>) {
  if (icon === "clock") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
        <polyline points="9 12 11 14 15 9.5" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3.2 3.2 0 0 1 0 6" />
      <path d="M17 14.4A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  );
}

export function WhyAlphaCISection({ reduced = false }: WhyAlphaCISectionProps) {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-soft)] px-[clamp(2rem,7vw,8rem)] py-[clamp(4rem,6vw,6rem)]"
      aria-labelledby="why-alphaci-title"
      data-why-alphaci-section="true"
    >
      <MorphingBlob reduced={reduced} tone="brand" className="left-1/2 top-[-140px] h-[440px] w-[680px] -translate-x-1/2" />
      <MorphingBlob reduced={reduced} tone="accent" delay={6} className="bottom-[-180px] right-[-120px] h-[380px] w-[460px]" />

      <motion.div
        className="relative z-[1] mx-auto mb-[clamp(2rem,3.5vw,3rem)] max-w-[52ch] text-center"
        initial={reduced ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: heroEase }}
      >
        <p className="mb-4 inline-flex items-center gap-2 font-mono text-[0.85rem] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
          <span className="size-[0.4rem] rounded-full bg-[var(--brand-accent)] shadow-[0_0_16px_rgba(106,168,255,0.6)]" aria-hidden="true" />
          Why AlphaCI
        </p>
        <h2 id="why-alphaci-title" className="m-0 text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-normal text-[var(--text-primary)]">
          Great software should not wait on plumbing.
        </h2>
      </motion.div>

      <div className="relative z-[1] grid grid-cols-3 gap-[clamp(1rem,2vw,1.5rem)] max-[860px]:grid-cols-1">
        {BENEFITS.map((benefit, index) => (
          <motion.article
            key={benefit.title}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur-md transition-[border-color,box-shadow,transform] duration-300 hover:border-blue-400/30 hover:shadow-[var(--shadow-card),0_0_40px_color-mix(in_srgb,var(--brand)_10%,transparent)]"
            data-benefit-card="true"
            data-tone={benefit.tone}
            initial={reduced ? undefined : { opacity: 0, y: 18 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            whileHover={reduced ? undefined : { y: -6 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: index * 0.12, duration: 0.45, ease: heroEase }}
          >
            <ScenePhoto
              src={benefit.photo}
              alt={benefit.photoAlt}
              className="h-44 w-full"
              imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="flex flex-1 flex-col gap-3 p-6">
              <span
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border-brand)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_16%,transparent),color-mix(in_srgb,var(--brand-accent)_7%,transparent))] text-[var(--brand)] shadow-[0_0_16px_color-mix(in_srgb,var(--brand)_15%,transparent)]",
                  benefit.tone === "accent" && "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(52,211,153,0.15),rgba(16,185,129,0.06))] text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.15)]",
                  benefit.tone === "violet" && "border-violet-300/35 bg-[linear-gradient(135deg,rgba(167,139,250,0.15),rgba(124,58,237,0.06))] text-violet-300 shadow-[0_0_16px_rgba(167,139,250,0.15)]",
                )}
                aria-hidden="true"
              >
                <BenefitGlyph icon={benefit.icon} />
              </span>
              <h3 className="m-0 text-[1.1rem] font-bold tracking-[-0.01em] text-[var(--text-primary)]">{benefit.title}</h3>
              <p className="m-0 text-[0.88rem] leading-[1.6] text-[var(--text-secondary)]">{benefit.body}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}


