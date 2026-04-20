"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const valueCards = [
  {
    icon: "gen" as const,
    title: "Source-backed generation",
    body: "Generate workflow files from templates mapped to real source files.",
  },
  {
    icon: "cicd" as const,
    title: "Automated CI/CD setup",
    body: "Apply service settings and output production-ready YAML in one flow.",
  },
  {
    icon: "agnt" as const,
    title: "Multi-agent workflow system",
    body: "Use guided tabs to move from setup to generated workflows and templates.",
  },
];

const heroChip = "Powered by source-backed templates";

function GenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function CicdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49"/>
    </svg>
  );
}

function AgntIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="18" r="3"/>
      <circle cx="6" cy="6" r="3"/>
      <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
      <line x1="6" y1="9" x2="6" y2="21"/>
    </svg>
  );
}

function CardIcon({ type }: { type: "gen" | "cicd" | "agnt" }) {
  if (type === "gen") return <GenIcon />;
  if (type === "cicd") return <CicdIcon />;
  return <AgntIcon />;
}

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const { status, session } = useAuthSession();
  const hasSubscription = hasActiveSubscription(session);

  let primaryHref = "/signup";
  let primaryLabel = "Sign up with Google or GitHub";
  let appHref = "/subscribe";
  let appLabel = "Pricing";
  let navUtilityHref = "/login";
  let navUtilityLabel = "Login";

  if (status === "signed-in") {
    appHref = "/home";
    appLabel = "Dashboard";
    navUtilityHref = "/home";
    navUtilityLabel = "Home";

    if (hasSubscription) {
      primaryHref = "/home";
      primaryLabel = "Open your workspace";
    } else {
      primaryHref = "/subscribe";
      primaryLabel = "Activate 300 pesos plan";
    }
  }

  return (
    <main className="flow-shell marketing-shell landing-layout">
      <FlowBackground />

      <div className="landing-content">
        <header className="marketing-nav glass-panel">
          <p className="brand-mark">FlowCI Studio</p>
          <nav aria-label="Primary" className="nav-links">
            <Link href="/workflows">Workflows</Link>
          </nav>
          <div className="landing-nav-actions">
            <Link className="ghost-button" href={navUtilityHref}>
              {navUtilityLabel}
            </Link>
            <Link className="primary-button" href={appHref}>
              {appLabel}
            </Link>
          </div>
        </header>

        <section className="landing-stage">
          <section className="hero-block landing-hero" aria-label="Main message">
            <motion.p
              className="hero-chip"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            >
              {heroChip}
            </motion.p>
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.42 }}
            >
              Build production-ready workflows{" "}
              <span className="hero-highlight">instantly</span>
            </motion.h1>
            <motion.p
              className="hero-description"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.08 }}
            >
              Transform service requirements into complete CI/CD pipelines with agent-guided setup,
              generation, and export in one place.
            </motion.p>
            <motion.div
              className="hero-actions"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
            >
              <Link className="primary-button" href={primaryHref}>
                {primaryLabel}
              </Link>
            </motion.div>
            <motion.div
              className="hero-mockup"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24, scale: 0.97 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="hero-mockup-bar">
                <span className="mockup-dot mockup-dot-red" />
                <span className="mockup-dot mockup-dot-yellow" />
                <span className="mockup-dot mockup-dot-green" />
              </div>
              <pre>
                <span className="mockup-comment"># Generated by FlowCI Studio</span>{"\n"}
                <span className="mockup-key">name</span>: <span className="mockup-string">payments-service-ci</span>{"\n"}
                <span className="mockup-key">on</span>:{"\n"}
                {"  "}<span className="mockup-key">push</span>:{"\n"}
                {"    "}<span className="mockup-key">branches</span>: <span className="mockup-string">{"[\"main\", \"develop\"]"}</span>{"\n"}
                <span className="mockup-key">jobs</span>:{"\n"}
                {"  "}<span className="mockup-key">build</span>:{"\n"}
                {"    "}<span className="mockup-key">runs-on</span>: <span className="mockup-string">ubuntu-latest</span>{"\n"}
                {"    "}<span className="mockup-keyword">steps</span>:{"\n"}
                {"      "}- <span className="mockup-key">uses</span>: <span className="mockup-string">actions/checkout@v4</span>{"\n"}
                {"      "}- <span className="mockup-key">name</span>: <span className="mockup-string">Run tests</span>
              </pre>
            </motion.div>
          </section>

          <section className="section-card glass-panel landing-features">
            <div className="value-grid">
              {valueCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  className="value-card"
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.38 }}
                >
                  <span className="value-card-icon" aria-hidden="true">
                    <CardIcon type={card.icon} />
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </motion.article>
              ))}
            </div>
          </section>
        </section>

        <section id="pricing" className="section-card pricing-card glass-panel">
          <div>
            <p className="hero-kicker">Pricing</p>
            <h2>Pro subscription is 300 pesos per month</h2>
            <p>Unlock setup tools and template access. Cancel anytime.</p>
            <div className="hero-actions" style={{ marginTop: "0.5rem" }}>
              <Link className="primary-button" href="/signup">
                Start for ₱300/month
              </Link>
              <Link className="ghost-button" href="/login">
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
