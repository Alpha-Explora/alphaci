"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { createGitHubLoginUrl } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const valueCards = [
  {
    title: "Source-backed templates",
    body: "Template cards map directly to files inside cicd-workflow so your team can trust where each pipeline starts.",
  },
  {
    title: "Setup in minutes",
    body: "Use GitHub login, open Setup Workflows, and generate validated YAML without rebuilding every rule by hand.",
  },
  {
    title: "Clear tabs per workflow function",
    body: "Switch between setup, current workflows, and all templates with no clutter.",
  },
];

const flowSteps = [
  "Sign up or log in with GitHub",
  "Choose the 300 pesos monthly subscription",
  "Open workflow tabs and generate your YAML",
];

const trustPills = ["Light UI", "GitHub OAuth", "cicd-workflow source-linked"];

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const { status, session } = useAuthSession();
  const hasSubscription = hasActiveSubscription(session);

  const signupHref = createGitHubLoginUrl("/auth/callback?intent=signup&next=%2Fhome");

  let primaryHref = signupHref;
  let primaryLabel = "Sign up with GitHub";
  let secondaryHref = "/login";
  let secondaryLabel = "Log in";
  let appHref = "/subscribe";
  let appLabel = "Pricing";

  if (status === "signed-in") {
    appHref = "/home";
    appLabel = "Dashboard";

    if (hasSubscription) {
      primaryHref = "/home";
      primaryLabel = "Open your workspace";
      secondaryHref = "/workflows";
      secondaryLabel = "Go to workflows";
    } else {
      primaryHref = "/subscribe";
      primaryLabel = "Activate 300 pesos plan";
      secondaryHref = "/subscribe";
      secondaryLabel = "See plan and unlock tabs";
    }
  }

  return (
    <main className="flow-shell marketing-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
        <nav aria-label="Primary" className="nav-links">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <Link href="/workflows">Workflows</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Sign up</Link>
        </nav>
        <Link className="ghost-button" href={appHref}>
          {appLabel}
        </Link>
      </header>

      <section className="hero-block glass-panel">
        <motion.p
          className="hero-kicker"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          Friendly CI/CD for teams that ship every week
        </motion.p>
        <motion.h1
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
        >
          Friendly CI/CD workflow studio for real teams.
        </motion.h1>
        <motion.p
          className="hero-description"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.08 }}
        >
          Build pipelines from source templates in cicd-workflow, then switch between Setup, Current,
          and All tabs to manage everything in one place.
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
          <Link className="ghost-button" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </motion.div>
        <ul className="pill-row" aria-label="Highlights">
          {trustPills.map((pill) => (
            <li key={pill} className="status-pill">
              {pill}
            </li>
          ))}
        </ul>
      </section>

      <section id="product" className="section-card glass-panel">
        <div className="section-header">
          <h2>How the workflow studio runs</h2>
          <p>Three simple steps from login to source-linked workflow output.</p>
        </div>
        <div className="step-track">
          {flowSteps.map((step, index) => (
            <article key={step} className="step-card">
              <span className="step-number">0{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card glass-panel">
        <div className="section-header">
          <h2>Built for practical release teams</h2>
        </div>
        <div className="value-grid">
          {valueCards.map((card) => (
            <article key={card.title} className="value-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="section-card pricing-card glass-panel">
        <div>
          <p className="hero-kicker">Pricing</p>
          <h2>Pro subscription is 300 pesos per month</h2>
          <p>
            Unlock setup tools, current workflow management, and full template access after GitHub sign in.
            Cancel anytime.
          </p>
        </div>
        <div className="pricing-actions">
          <Link className="primary-button" href="/subscribe">
            Subscribe for 300 pesos
          </Link>
          <Link className="ghost-button" href="/login">
            Open login page
          </Link>
        </div>
      </section>
    </main>
  );
}
