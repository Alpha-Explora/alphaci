"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { createGitHubLoginUrl, warmupBackend } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

interface OAuthAuthPageProps {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  switchText: string;
  switchHref: string;
  switchCta: string;
}

function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.77.5 12.27c0 5.2 3.3 9.6 7.88 11.15.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.53-1.37-1.29-1.73-1.29-1.73-1.05-.74.08-.73.08-.73 1.17.08 1.78 1.22 1.78 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.72-1.58-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.33 1.18-3.16-.12-.3-.51-1.53.11-3.19 0 0 .97-.32 3.18 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.52 3.17-1.2 3.17-1.2.63 1.66.24 2.9.12 3.19.73.83 1.17 1.88 1.17 3.16 0 4.51-2.71 5.49-5.3 5.78.41.37.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .31.21.69.8.57a11.83 11.83 0 0 0 7.87-11.15C23.5 5.77 18.35.5 12 .5Z"
      />
    </svg>
  );
}

function toSafeNextPath(raw: string | null): string {
  if (!raw) return "/home";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/home";
}

const pipelineStages = [
  { label: "Source", color: "#1a56db", done: true },
  { label: "Build",  color: "#1a56db", done: true },
  { label: "Test",   color: "#1a56db", done: true },
  { label: "Deploy", color: "#12b76a", done: true },
];

function PipelineStagesVisual() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {pipelineStages.map((stage, i) => (
        <div key={stage.label} style={{ display: "flex", alignItems: "center", flex: i < pipelineStages.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: stage.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 0 4px ${stage.color}22`,
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {stage.label}
            </span>
          </div>
          {i < pipelineStages.length - 1 && (
            <div style={{ flex: 1, margin: "0 0.3rem", marginBottom: "1.1rem", position: "relative", height: 2 }}>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${stage.color}30, ${pipelineStages[i + 1].color}30)`, borderRadius: 999 }} />
              <motion.div
                initial={{ scaleX: 0, transformOrigin: "left" }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.4 + i * 0.3, ease: "easeInOut" }}
                style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${stage.color}, ${pipelineStages[i + 1].color})`, borderRadius: 999, boxShadow: `0 0 8px ${stage.color}` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function OAuthAuthPage({
  mode,
  title,
  subtitle,
  switchText,
  switchHref,
  switchCta,
}: Readonly<OAuthAuthPageProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [isWarming, setIsWarming] = useState<boolean>(false);

  const { status, session } = useAuthSession();

  const nextPath = useMemo(() => toSafeNextPath(searchParams.get("next")), [searchParams]);
  const githubCallbackReturnTo = useMemo(() => {
    const callbackPath = new URLSearchParams({
      intent: mode,
      next: nextPath,
      provider: "github",
    });
    return `/auth/callback?${callbackPath.toString()}`;
  }, [mode, nextPath]);

  const githubLoginHref = useMemo(() => createGitHubLoginUrl(githubCallbackReturnTo), [githubCallbackReturnTo]);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [3.2, -3.2]), {
    stiffness: 190, damping: 24, mass: 0.45,
  });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-3.2, 3.2]), {
    stiffness: 190, damping: 24, mass: 0.45,
  });

  useEffect(() => {
    if (status !== "signed-in") return;
    if (hasActiveSubscription(session)) {
      router.replace(nextPath);
      return;
    }
    router.replace("/subscribe");
  }, [nextPath, router, session, status]);

  function handleCardPointerMove(event: MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    pointerX.set(Math.max(-0.5, Math.min(0.5, x)));
    pointerY.set(Math.max(-0.5, Math.min(0.5, y)));
  }

  function handleCardPointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <main className="auth-shell-split">
      <FlowBackground />

      <div className="auth-left-panel">
        <div style={{ flexShrink: 0 }}>
          <div className="brand-mark">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1rem", padding: "1rem 0" }}>
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <PipelineStagesVisual />
          </motion.div>

          {/* Feature bullets — staggered reveal */}
          <motion.div
            style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            {[
              { label: "Source-backed YAML generation", accent: "var(--brand)" },
              { label: "40+ framework templates ready", accent: "var(--brand-accent)" },
              { label: "GitHub repo + branch rules setup", accent: "var(--brand)" },
              { label: "Export and push in under 2 minutes", accent: "var(--brand-accent)" },
            ].map((bullet, i) => (
              <motion.div
                key={bullet.label}
                initial={prefersReducedMotion ? undefined : { opacity: 0, x: -12 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.55 + i * 0.08 }}
                style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: bullet.accent,
                    flexShrink: 0,
                    boxShadow: `0 0 8px ${bullet.accent}`,
                  }}
                />
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {bullet.label}
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            className="editorial-glass-panel"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            style={{ marginBottom: "0", marginTop: "0.5rem", marginLeft: "0", maxWidth: "100%", padding: "1.25rem", borderRadius: "2px" }}
          >
            <div className="hero-mockup-bar" style={{ marginBottom: "0.75rem", opacity: 0.5 }}>
              <span className="mockup-dot mockup-dot-red" aria-hidden="true" />
              <span className="mockup-dot mockup-dot-yellow" aria-hidden="true" />
              <span className="mockup-dot mockup-dot-green" aria-hidden="true" />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                payments-service.yml
              </span>
            </div>
            <pre style={{ background: "transparent", color: "var(--text-primary)", padding: 0, margin: 0, fontSize: "0.75rem", lineHeight: 1.6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflow: "hidden" }} aria-hidden="true">
              <span style={{ color: "var(--text-muted)" }}>{`# Generated by FlowCI Studio\n`}</span>
              <span style={{ color: "var(--brand)" }}>name</span><span style={{ color: "var(--text-primary)" }}>: </span><span style={{ color: "var(--brand-accent)" }}>{`payments-service-ci\n`}</span>
              <span style={{ color: "var(--brand)" }}>on</span><span style={{ color: "var(--text-primary)" }}>{`:\n`}</span>
              <span style={{ color: "var(--text-primary)" }}>{"  "}</span><span style={{ color: "var(--brand)" }}>push</span><span style={{ color: "var(--text-primary)" }}>{`:\n`}</span>
              <span style={{ color: "var(--text-primary)" }}>{"    "}</span><span style={{ color: "var(--brand)" }}>branches</span><span style={{ color: "var(--text-primary)" }}>: [</span><span style={{ color: "var(--brand-accent)" }}>&quot;main&quot;</span><span style={{ color: "var(--text-primary)" }}>, </span><span style={{ color: "var(--brand-accent)" }}>&quot;develop&quot;</span><span style={{ color: "var(--text-primary)" }}>{`]\n`}</span>
              <span style={{ color: "var(--brand)" }}>jobs</span><span style={{ color: "var(--text-primary)" }}>{`:\n`}</span>
              <span style={{ color: "var(--text-primary)" }}>{"  "}</span><span style={{ color: "var(--brand)" }}>build</span><span style={{ color: "var(--text-primary)" }}>{`:\n`}</span>
              <span style={{ color: "var(--text-primary)" }}>{"    "}</span><span style={{ color: "var(--brand)" }}>runs-on</span><span style={{ color: "var(--text-primary)" }}>: </span><span style={{ color: "var(--brand-accent)" }}>ubuntu-latest</span>
            </pre>
          </motion.div>
        </div>
      </div>


      <div className="auth-right-panel">
        <motion.div
          className="auth-card-shell"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14, scale: 0.985 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          onMouseMove={handleCardPointerMove}
          onMouseLeave={handleCardPointerLeave}
          style={
            prefersReducedMotion
              ? undefined
              : { transformPerspective: 1100, rotateX, rotateY }
          }
        >
          <div className="auth-header">
            <motion.p
              className="hero-kicker"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            >
              {mode === "login" ? "Log in" : "Sign up"}
            </motion.p>
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {title}
            </motion.h1>
            <p className="auth-subtitle">{subtitle}</p>
          </div>

          <div className="auth-provider-single">
            <motion.a
              href={githubLoginHref}
              aria-disabled={isWarming}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.01, boxShadow: "0 0 24px rgba(56, 189, 248, 0.2)" }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                width: "100%",
                padding: "0.9rem 1.5rem",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "0.75rem",
                textDecoration: "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                cursor: "pointer",
                ...(isWarming ? { pointerEvents: "none", opacity: 0.6 } : {}),
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "rgba(56, 189, 248, 0.6)";
                el.style.boxShadow = "0 0 20px rgba(56,189,248,0.15)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "rgba(255,255,255,0.12)";
                el.style.boxShadow = "none";
              }}
              onClick={async (e) => {
                e.preventDefault();
                setIsWarming(true);
                try {
                  await warmupBackend();
                } catch {
                  // Intentionally swallowed — warmup failure must not block login.
                } finally {
                  setIsWarming(false);
                }
                window.location.href = githubLoginHref;
              }}
            >
              <span aria-hidden="true" style={{ display: "flex", alignItems: "center", flexShrink: 0, width: "20px", height: "20px", color: "var(--text-primary)" }}>
                <GitHubGlyph />
              </span>
              <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                {isWarming
                  ? "Connecting..."
                  : mode === "login"
                  ? "Continue with GitHub"
                  : "Sign up with GitHub"}
              </span>
            </motion.a>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.5rem" }}>
              Your repos, pipelines, and workflow history stay connected.
            </p>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", marginTop: "0.25rem" }}>
            <Link
              href="/subscribe"
              style={{
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                textDecoration: "none",
                borderBottom: "1px solid var(--border-soft)",
                paddingBottom: "1px",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; }}
            >
              View pricing
            </Link>
            <span style={{ color: "var(--border)", fontSize: "0.82rem" }} aria-hidden="true">·</span>
            <Link
              href="/"
              style={{
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                textDecoration: "none",
                borderBottom: "1px solid var(--border-soft)",
                paddingBottom: "1px",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; }}
            >
              Home
            </Link>
          </div>

          {status === "loading" ? <p className="helper-text">Checking current session...</p> : null}

          <p className="auth-switch-text">
            {switchText} <Link href={switchHref}>{switchCta}</Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
