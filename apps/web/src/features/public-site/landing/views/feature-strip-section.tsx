import { motion } from "framer-motion";

import { cn } from "@/shared/ui/cn";

type FeatureIconType = "gen" | "cicd" | "agnt";
type FeatureTone = "brand" | "accent" | "violet";

interface FeatureCard {
  icon: FeatureIconType;
  eyebrow: string;
  title: string;
  body: string;
  tone: FeatureTone;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: "gen",
    eyebrow: "features/generation",
    title: "Source-backed generation",
    body: "AlphaCI reads your stack and generates YAML that matches your project - not boilerplate.",
    tone: "brand",
  },
  {
    icon: "cicd",
    eyebrow: "features/automation",
    title: "Guided setup to export",
    body: "Pick a template, set your variables, export production-ready GitHub Actions YAML. No editing.",
    tone: "accent",
  },
  {
    icon: "agnt",
    eyebrow: "features/security",
    title: "A gate before every merge",
    body: "Tests, lint, and security audits run on every change - errors surface before they reach main.",
    tone: "violet",
  },
];

function GenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CicdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49" />
    </svg>
  );
}

function AgntIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  );
}

function FeatureIcon({ type }: Readonly<{ type: FeatureIconType }>) {
  if (type === "gen") return <GenIcon />;
  if (type === "cicd") return <CicdIcon />;
  return <AgntIcon />;
}

interface FeatureStripSectionProps {
  reduced?: boolean;
}

export function FeatureStripSection({ reduced = false }: Readonly<FeatureStripSectionProps>) {
  return (
    <section
      className="relative grid w-full grid-cols-3 gap-[clamp(1rem,2vw,1.5rem)] bg-transparent px-[clamp(2rem,7vw,8rem)] py-[clamp(3rem,5vw,5rem)] max-[700px]:grid-cols-1"
      aria-label="Key features"
      data-feature-strip-section="true"
    >
      {FEATURE_CARDS.map((card, index) => (
        <motion.div
          key={card.title}
          className="relative z-[1] flex min-h-60 flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-elevated/70 px-8 py-10 text-secondary-text backdrop-blur-md transition-[border-color,box-shadow,transform] duration-300 hover:border-blue-400/30 hover:shadow-[var(--shadow-card),0_0_40px_color-mix(in_srgb,var(--brand)_10%,transparent)]"
          data-feature-card="true"
          data-tone={card.tone}
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          whileHover={reduced ? undefined : { y: -8, scale: 1.02 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: index * 0.12, duration: 0.4 }}
        >
          <div
            className={cn(
              "pointer-events-none absolute right-0 top-0 size-20 rounded-tr-2xl bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--brand)_12%,transparent)_0%,transparent_70%)]",
              card.tone === "accent" && "bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.1)_0%,transparent_70%)]",
              card.tone === "violet" && "bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.12)_0%,transparent_70%)]",
            )}
            aria-hidden="true"
          />
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-brand">0{index + 1}</span>
          <span
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-[0.6rem] border border-border-brand bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_15%,transparent),color-mix(in_srgb,var(--brand-strong)_6%,transparent))] text-brand shadow-[0_0_16px_color-mix(in_srgb,var(--brand)_15%,transparent)]",
              card.tone === "accent" && "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(52,211,153,0.15),rgba(16,185,129,0.06))] text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.15)]",
              card.tone === "violet" && "border-violet-300/35 bg-[linear-gradient(135deg,rgba(167,139,250,0.15),rgba(124,58,237,0.06))] text-violet-300 shadow-[0_0_16px_rgba(167,139,250,0.15)]",
            )}
            aria-hidden="true"
          >
            <FeatureIcon type={card.icon} />
          </span>
          <div>
            <p className="mb-[0.15rem] mt-0 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-text">{card.eyebrow}</p>
            <h3 className="m-0 text-[1.05rem] font-bold tracking-[-0.01em] text-foreground">{card.title}</h3>
          </div>
          <p className="m-0 text-[0.85rem] leading-[1.6] text-secondary-text">{card.body}</p>
        </motion.div>
      ))}
    </section>
  );
}


