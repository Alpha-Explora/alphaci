"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { activateMockSubscription } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const planFeatures = [
  "Unlimited workflow generation",
  "Priority template updates",
  "Advanced approvals",
];

export default function SubscribePage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const hasSubscription = hasActiveSubscription(session);

  useEffect(() => {
    if (status === "signed-in" && hasSubscription) {
      router.replace("/home");
    }
  }, [hasSubscription, router, status]);

  async function handleActivate() {
    setStatusMessage(null);
    setIsActivating(true);

    try {
      await activateMockSubscription("pro");
      await refresh();
      setStatusMessage("Pro plan activated. Redirecting to your home page...");
      router.push("/home");
    } catch {
      setStatusMessage("Subscription activation failed. Please try again.");
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/">Landing</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/workflows">Workflows</Link>
        </nav>
        <Link className="ghost-button" href="/">
          Back to landing
        </Link>
      </header>

      <section className="section-card pricing-page-card glass-panel">
        <motion.p
          className="hero-kicker"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          Subscription
        </motion.p>
        <motion.h1
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Pro is 300 pesos per month
        </motion.h1>
        <p>Connect GitHub and unlock full workflow generation. Cancel anytime.</p>

        <div className="price-band">
          <p className="price-amount">300 pesos</p>
          <p className="price-cycle">monthly subscription</p>
        </div>

        <ul className="feature-list" aria-label="Plan features">
          {planFeatures.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>

        <div className="hero-actions">
          {status === "signed-out" ? (
            <>
              <Link className="primary-button" href="/signup">
                Sign up first
              </Link>
              <Link className="ghost-button" href="/login">
                Already have an account? Log in
              </Link>
            </>
          ) : null}

          {status === "signed-in" && !hasSubscription ? (
            <button className="primary-button" type="button" disabled={isActivating} onClick={handleActivate}>
              {isActivating ? "Activating..." : "Activate Pro for 300 pesos"}
            </button>
          ) : null}

          <Link className="ghost-button" href="/workflows">
            Browse workflows
          </Link>
        </div>

        {status === "loading" ? <p className="helper-text">Checking your account status...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {statusMessage ? <p className="helper-text">{statusMessage}</p> : null}
      </section>
    </main>
  );
}
