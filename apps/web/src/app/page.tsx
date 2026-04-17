"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { createGitHubLoginUrl } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const valueCards = [
  {
    icon: "GEN",
    title: "Source-backed generation",
    body: "Generate workflow files from templates mapped to real source files.",
  },
  {
    icon: "CICD",
    title: "Automated CI/CD setup",
    body: "Apply service settings and output production-ready YAML in one flow.",
  },
  {
    icon: "AGNT",
    title: "Multi-agent workflow system",
    body: "Use guided tabs to move from setup to generated workflows and templates.",
  },
];

const heroChip = "Powered by source-backed templates";

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const { status, session } = useAuthSession();
  const hasSubscription = hasActiveSubscription(session);

  const signupHref = createGitHubLoginUrl("/auth/callback?intent=signup&next=%2Fhome");

  let primaryHref = signupHref;
  let primaryLabel = "Sign up with GitHub";
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
          </section>

          <section className="section-card glass-panel landing-features">
            <div className="value-grid">
              {valueCards.map((card) => (
                <article key={card.title} className="value-card">
                  <span className="value-card-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section id="pricing" className="section-card pricing-card glass-panel">
          <div>
            <p className="hero-kicker">Pricing</p>
            <h2>Pro subscription is 300 pesos per month</h2>
            <p>Unlock setup tools and template access. Cancel anytime.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
