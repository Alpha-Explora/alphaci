"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { SubscriptionCongratsModal } from "@/components/product/subscription-congrats-modal";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  activateMonthlySubscription,
  cancelMonthlySubscription,
  createSubscriptionCheckout,
  getCheckoutStatus,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const CONGRATS_SESSION_KEY = "flowci_congrats_shown";
const CHECKOUT_SESSION_KEY = "flowci_paymongo_checkout_id";

const proPlan = {
  key: "pro" as const,
  title: "Pro Monthly",
  amount: "300",
  summary: "For builders shipping service pipelines every week.",
  features: [
    "Unlimited workflow generation",
    "Advanced approval toggles",
    "Template updates as soon as they ship",
    "Workflow history synced to your account",
    "GitHub repository creation with branch rulesets",
  ],
};

const activationChecklist = [
  "Connect your GitHub account",
  "Activate Pro Monthly",
  "Open Create Project",
  "Create a GitHub project with managed CI",
];

const featureCategories = [
  {
    label: "Core features",
    icon: WorkflowIcon,
    items: ["Unlimited workflow generation", "Advanced approval toggles", "Template updates as soon as they ship"],
  },
  {
    label: "GitHub integration",
    icon: GitHubIcon,
    items: ["Repository creation with branch rulesets", "GitHub Actions YAML generation", "Push-to-deploy pipeline setup"],
  },
  {
    label: "History & account",
    icon: HistoryIcon,
    items: ["Workflow history synced to account", "Re-download any generated workflow", "Single user plan, unlimited repos"],
  },
];

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WorkflowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function GitHubIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.77.5 12.27c0 5.2 3.3 9.6 7.88 11.15.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.53-1.37-1.29-1.73-1.29-1.73-1.05-.74.08-.73.08-.73 1.17.08 1.78 1.22 1.78 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.72-1.58-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.33 1.18-3.16-.12-.3-.51-1.53.11-3.19 0 0 .97-.32 3.18 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.52 3.17-1.2 3.17-1.2.63 1.66.24 2.9.12 3.19.73.83 1.17 1.88 1.17 3.16 0 4.51-2.71 5.49-5.3 5.78.41.37.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .31.21.69.8.57a11.83 11.83 0 0 0 7.87-11.15C23.5 5.77 18.35.5 12 .5Z" />
    </svg>
  );
}

function HistoryIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
    </svg>
  );
}

function SubscribePageContent() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, session, error, refresh } = useAuthSession();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [showMockFallback, setShowMockFallback] = useState(true);

  useEffect(() => {
    if (status === "signed-in" && hasActiveSubscription(session)) {
      router.replace("/home");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(CONGRATS_SESSION_KEY)) {
      setShowCongratsModal(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "signed-in" || searchParams.get("status") !== "success") {
      return;
    }

    const checkoutId =
      typeof window !== "undefined"
        ? sessionStorage.getItem(CHECKOUT_SESSION_KEY)
        : null;

    if (!checkoutId) return;

    const confirmedCheckoutId = checkoutId;
    let active = true;

    async function confirmCheckout() {
      setIsSubmitting(true);
      setActionError(null);

      try {
        const result = await getCheckoutStatus(confirmedCheckoutId);
        if (!active) return;

        if (result.status === "paid") {
          sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
          await refresh();
          setStatusMessage("PayMongo payment confirmed. Pro monthly plan is active.");
          if (!sessionStorage.getItem(CONGRATS_SESSION_KEY)) {
            setShowCongratsModal(true);
          }
          return;
        }

        setStatusMessage(`Checkout status: ${result.status}. Refresh after PayMongo confirms payment.`);
      } catch {
        if (active) {
          setActionError("Could not confirm PayMongo checkout status. Please retry.");
        }
      } finally {
        if (active) setIsSubmitting(false);
      }
    }

    void confirmCheckout();
    return () => { active = false; };
  }, [refresh, searchParams, status]);

  const hasSubscription = hasActiveSubscription(session);
  const activePlan = session?.subscription.plan;
  const isCurrentPlanActive = hasSubscription && activePlan === "pro";

  let activateButtonLabel = "Activate Pro Monthly";
  if (isSubmitting) activateButtonLabel = "Processing...";
  else if (isCurrentPlanActive) activateButtonLabel = "Current plan active";

  async function handleActivate() {
    setStatusMessage(null);
    setActionError(null);
    setIsSubmitting(true);

    try {
      const checkout = await createSubscriptionCheckout("pro");
      if (!checkout.redirectUrl || !checkout.checkoutId) {
        throw new Error("Checkout session did not include redirect details.");
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CHECKOUT_SESSION_KEY, checkout.checkoutId);
        window.location.assign(checkout.redirectUrl);
      }
    } catch (checkoutError) {
      const apiError = checkoutError as ApiError;
      if (apiError.status === 503) {
        setActionError("PayMongo checkout is unavailable in this environment.");
        setShowMockFallback(true);
      } else {
        setActionError("Subscription checkout failed. Please try again.");
      }
      setIsSubmitting(false);
    }
  }

  async function handleMockActivate() {
    setStatusMessage(null);
    setActionError(null);
    setIsSubmitting(true);

    try {
      await activateMonthlySubscription("pro");
      await refresh();
      setStatusMessage("Pro monthly plan is active. Your workspace is ready.");
      if (typeof window !== "undefined" && !sessionStorage.getItem(CONGRATS_SESSION_KEY)) {
        setShowCongratsModal(true);
      }
    } catch {
      setActionError("Local mock activation is unavailable in this environment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setStatusMessage(null);
    setActionError(null);
    setIsSubmitting(true);

    try {
      await cancelMonthlySubscription();
      await refresh();
      setStatusMessage("Monthly subscription canceled.");
    } catch {
      setActionError("Cancel request failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCongratsClose() {
    setShowCongratsModal(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CONGRATS_SESSION_KEY, "1");
    }
  }

  return (
    <main className="flow-shell page-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <FlowBackground />

      {/* Marketing nav */}
      <header className="marketing-nav marketing-nav-enhanced">
        <Link className="brand-mark" href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <PipelineLogo size={22} />
          <span>FlowCI Studio</span>
        </Link>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/workflows">Workflows</Link>
        </nav>
        <Link className="ghost-button" href="/" style={{ fontSize: "0.82rem", padding: "0.38rem 0.85rem" }}>
          Back to Home
        </Link>
      </header>

      <div id="main-content">
        {/* ── Main pricing card + comparison ──────────────────────── */}
        <div
          style={{
            padding: "clamp(1.5rem,2.5vw,2.5rem) clamp(1.5rem,4vw,3rem) 2rem",
            maxWidth: 960,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.5rem",
              alignItems: "start",
            }}
            className="subscribe-grid"
          >
            {/* Left: pricing card */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="glass-panel pricing-card-enhanced"
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {/* Animated top border */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg, transparent, var(--brand), var(--brand-accent), transparent)",
                  backgroundSize: "200% 100%",
                  animation: "gradient-shift 4s linear infinite",
                }}
              />

              {/* Glow orb in corner */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 150,
                  height: 150,
                  background: "radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                }}
              />

              <div>
                <p
                  style={{
                    fontSize: "0.68rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--text-muted)",
                    margin: "0 0 0.4rem",
                  }}
                >
                  {proPlan.title}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", marginBottom: "0.3rem" }}>
                  <span
                    style={{
                      fontSize: "clamp(2.4rem, 5vw, 3.2rem)",
                      fontWeight: 800,
                      lineHeight: 1,
                      background: "linear-gradient(135deg, var(--text-primary), var(--brand))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      color: "var(--text-primary)",
                    }}
                  >
                    &#8369;{proPlan.amount}
                  </span>
                  <span style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>/ month</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                  {proPlan.summary}
                </p>
              </div>

              {/* Divider */}
              <div
                aria-hidden="true"
                style={{
                  height: 1,
                  background: "linear-gradient(90deg, transparent, var(--border), transparent)",
                }}
              />

              {/* Feature list */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {proPlan.features.map((feat) => (
                  <li
                    key={feat}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.6rem",
                      fontSize: "0.88rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "1.1rem",
                        height: "1.1rem",
                        borderRadius: "50%",
                        background: "rgba(52, 211, 153, 0.12)",
                        border: "1px solid rgba(52, 211, 153, 0.3)",
                        flexShrink: 0,
                        marginTop: "0.1rem",
                        color: "var(--success)",
                      }}
                      aria-hidden="true"
                    >
                      <CheckIcon />
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>

              {/* Popular badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(52,211,153,0.07))",
                  border: "1px solid rgba(56,189,248,0.22)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "var(--brand)",
                  width: "fit-content",
                }}
                aria-label="No seat limits or usage tiers"
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "var(--brand-accent)",
                    animation: "flowPulse 2s ease-in-out infinite",
                  }}
                />
                No seat limits or usage tiers
              </div>
            </motion.div>

            {/* Right: activation + checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Activation section */}
              <motion.div
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="glass-panel"
                style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "var(--text-muted)",
                      margin: "0 0 0.5rem",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    activate / get-started
                  </p>
                  <h2 style={{ fontSize: "clamp(1.1rem,2vw,1.35rem)", margin: "0 0 0.3rem" }}>
                    Activate Pro Monthly
                  </h2>
                  <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.85rem" }}>
                    <strong>&#8369;300/month</strong>. Cancel any time.
                  </p>
                </div>

                {/* Checklist */}
                <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {activationChecklist.map((item, index) => (
                    <li
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        fontSize: "0.84rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "1.4rem",
                          height: "1.4rem",
                          borderRadius: "50%",
                          background: "rgba(56, 189, 248, 0.1)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          color: "var(--brand)",
                          flexShrink: 0,
                          fontFamily: "ui-monospace, monospace",
                        }}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {status === "signed-out" && (
                    <>
                      <Link className="primary-button" href="/signup" style={{ textAlign: "center" }}>
                        Sign up with GitHub first
                      </Link>
                      <Link className="ghost-button" href="/login" style={{ textAlign: "center", fontSize: "0.84rem" }}>
                        Already have an account? Log in
                      </Link>
                    </>
                  )}

                  {status === "signed-in" && (
                    <>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={isSubmitting || isCurrentPlanActive}
                        onClick={() => void handleActivate()}
                        style={{ width: "100%" }}
                      >
                        {activateButtonLabel}
                      </button>
                      {showMockFallback && (
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={isSubmitting || isCurrentPlanActive}
                          onClick={() => void handleMockActivate()}
                          style={{ width: "100%" }}
                        >
                          Local mock activate
                        </button>
                      )}
                      {hasSubscription && (
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={isSubmitting || !hasSubscription}
                          onClick={() => void handleCancel()}
                          style={{ width: "100%", color: "var(--text-muted)", fontSize: "0.82rem" }}
                        >
                          Cancel subscription
                        </button>
                      )}
                    </>
                  )}

                  <Link
                    className="ghost-button"
                    href="/workflows"
                    style={{ textAlign: "center", fontSize: "0.82rem" }}
                  >
                    Go to Create Project
                  </Link>
                </div>

                {actionError && <p className="error-text" role="alert">{actionError}</p>}
                {statusMessage && <p className="helper-text">{statusMessage}</p>}
              </motion.div>

              {/* What's included icon grid */}
              <motion.div
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.18 }}
                className="glass-panel"
                style={{ padding: "1.5rem" }}
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--text-muted)",
                    margin: "0 0 1rem",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  what&apos;s included
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {featureCategories.map((cat, catIdx) => {
                    const CatIcon = cat.icon;
                    return (
                      <div key={cat.label} style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "1.5rem",
                              height: "1.5rem",
                              borderRadius: "0.35rem",
                              background: catIdx === 1 ? "rgba(52,211,153,0.1)" : "rgba(56,189,248,0.1)",
                              border: catIdx === 1 ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(56,189,248,0.2)",
                              color: catIdx === 1 ? "var(--brand-accent)" : "var(--brand)",
                            }}
                          >
                            <CatIcon size={11} />
                          </span>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                            {cat.label}
                          </span>
                        </div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, paddingLeft: "0.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {cat.items.map((item) => (
                            <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              <span aria-hidden="true" style={{ color: "var(--success)", flexShrink: 0, marginTop: "0.1rem" }}>
                                <CheckIcon />
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── Billing notes ─────────────────────────────────────────── */}
        <div
          style={{
            padding: "2rem clamp(1.5rem,4vw,3rem) clamp(3rem,6vw,5rem)",
            maxWidth: 960,
            margin: "0 auto",
            width: "100%",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>billing/notes.md</p>
          <h2 style={{ fontSize: "clamp(1.1rem,2vw,1.4rem)", marginBottom: "0.75rem" }}>Billing notes</h2>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 0.75rem", lineHeight: 1.65, maxWidth: 560 }}>
            This billing flow is environment-backed for product testing. Activate Pro Monthly and validate
            entitlement changes immediately in Create Project.
          </p>
          <p style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.65, fontSize: "0.88rem", maxWidth: 560 }}>
            If your status updates but UI still shows old data, run a session refresh by revisiting login or home.
          </p>

          {status === "loading" && <p className="helper-text" style={{ marginTop: "0.75rem" }}>Checking your account status...</p>}
          {error && <p className="error-text" style={{ marginTop: "0.75rem" }}>{error}</p>}
        </div>
      </div>

      {showCongratsModal && (
        <SubscriptionCongratsModal
          planName={proPlan.title}
          onClose={handleCongratsClose}
        />
      )}
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="flow-shell page-shell">
          <FlowBackground />
          <div className="state-body">
            <div className="state-card">
              <div className="state-spinner" role="status" aria-label="Loading billing" />
              <h1>Loading billing</h1>
              <p>Preparing checkout state.</p>
            </div>
          </div>
        </main>
      }
    >
      <SubscribePageContent />
    </Suspense>
  );
}
