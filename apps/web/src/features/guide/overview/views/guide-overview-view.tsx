"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { PublicSiteNav } from "@/shared/layout/public-site-nav";
import { FlowExplainer } from "@/components/product/flow-explainer";
import { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

/* Level 0 in the skill's progressive depth: the guide has no data of its own,
 * so there is no view-model and no data layer. Sign-out is the one action, and
 * it goes through useAuthSession. */

/* ── Motion ────────────────────────────────────────────────────────────────── */

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT, delay: i * 0.05 },
  }),
};

/* ── Content model ─────────────────────────────────────────────────────────── */

interface GuideSection {
  id: string;
  title: string;
}

const SECTIONS: GuideSection[] = [
  { id: "welcome", title: "What is ALPHACI" },
  { id: "getting-started", title: "Getting started" },
  { id: "creating-a-project", title: "Creating a project" },
  { id: "branch-strategy", title: "Branch strategy" },
  { id: "quality-gates", title: "CI/CD quality gates" },
  { id: "managing-projects", title: "Managing your projects" },
  { id: "faq", title: "FAQ & troubleshooting" },
];

/* ── Small presentational helpers ───────────────────────────────────────────── */

function GuideCard({
  id,
  index,
  title,
  reduced,
  children,
}: Readonly<{
  id: string;
  index: number;
  title: string;
  reduced: boolean;
  children: React.ReactNode;
}>) {
  return (
    <motion.section
      id={id}
      className="section-card glass-panel"
      style={{
        scrollMarginTop: "6rem",
        padding: "1.6rem 1.7rem",
        marginBottom: "1.1rem",
      }}
      custom={index}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      whileInView={reduced ? undefined : "visible"}
      animate={reduced ? "visible" : undefined}
      viewport={{ once: true, margin: "-80px" }}
    >
      <h2
        style={{
          fontSize: "1.18rem",
          fontWeight: 700,
          marginBottom: "0.7rem",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      <div className="guide-prose">{children}</div>
    </motion.section>
  );
}

function FaqItem({
  q,
  children,
}: Readonly<{ q: string; children: React.ReactNode }>) {
  return (
    <details className="guide-faq-item">
      <summary>{q}</summary>
      <div style={{ marginTop: "0.5rem" }}>{children}</div>
    </details>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function PublicGuidePage({ error }: Readonly<{ error: string | null }>) {
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;
  const steps = [
    {
      label: "Stack",
      title: "Choose your stack",
      body: "Pick the repository shape, framework, runtime, and checks that match the project you want to ship.",
    },
    {
      label: "Repo",
      title: "Generate the repository",
      body: "ALPHACI creates the GitHub repository, starter project, protected branches, and workflow files.",
    },
    {
      label: "Gates",
      title: "Promote safely",
      body: "Changes move through test, uat, and main with pull requests, quality gates, and approvals.",
    },
    {
      label: "Deploy",
      title: "Deploy to hosting",
      body: "Connect your own Vercel or Render account from the same governed pipeline.",
    },
  ];

  return (
    <main className="public-guide-shell" suppressHydrationWarning>
      <a href="#guide-main" className="skip-link">
        Skip to guide content
      </a>
      <FlowBackground />
      <PublicSiteNav active="guide" />

      <div id="guide-main" className="public-guide-content">
        <motion.section
          className="public-guide-hero"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
        >
          <div>
            <h1>How ALPHACI works</h1>
            <p>
              ALPHACI turns a project idea into a governed GitHub repository
              with CI/CD, branch promotion, quality gates, and deployment
              targets already wired in.
            </p>
          </div>
          <div className="public-guide-actions">
            <Link className="public-site-cta" href="/signup">
              Start free
            </Link>
            <Link className="public-guide-link" href="/login">
              Sign in
            </Link>
          </div>
        </motion.section>

        {error && (
          <p className="public-guide-status" role="status">
            Session check failed, but the public guide is still available.
          </p>
        )}

        <section
          className="public-guide-workflow"
          aria-label="ALPHACI workflow"
        >
          <div className="public-guide-workflow-head">
            <div>
              <p>Workflow setup preview</p>
              <h2>From setup to governed deploy</h2>
            </div>
            <div
              className="public-guide-branch-flow"
              aria-label="Branch promotion path"
            >
              <span>test</span>
              <i aria-hidden="true" />
              <span>uat</span>
              <i aria-hidden="true" />
              <span>main</span>
            </div>
          </div>

          <div className="public-guide-workflow-body">
            <div className="public-guide-step-list">
              {steps.map((step, index) => (
                <motion.article
                  key={step.title}
                  className="public-guide-step"
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.28,
                    ease: EASE_OUT,
                    delay: index * 0.04,
                  }}
                >
                  <div className="public-guide-step-top">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step.label}</strong>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </motion.article>
              ))}
            </div>

            <motion.aside
              className="public-guide-workflow-panel"
              aria-label="Generated workflow preview"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.12 }}
            >
              <div className="public-guide-panel-top">
                <span>alphaci.yml</span>
                <strong>ready</strong>
              </div>
              <pre aria-hidden="true">{`repo:
  runtime: next
  branches:
    - test
    - uat
    - main

checks:
  install: npm ci
  quality: npm test
  build: npm run build

deploy:
  provider: byo_vercel
  promote: on_approval`}</pre>
            </motion.aside>
          </div>
        </section>

        <section
          className="public-guide-flow"
          aria-label="Branch promotion model"
        >
          <div>
            <h2>Built around promotion, not just generation</h2>
            <p>
              ALPHACI does not just produce a YAML file. It gives teams a
              repeatable path from feature work to production so every repo
              follows the same release discipline.
            </p>
          </div>
          <FlowExplainer heading={null} variant="compact" />
        </section>

        <section className="public-guide-final">
          <h2>Ready to build your first workflow?</h2>
          <div>
            <Link className="public-site-cta" href="/signup">
              Start free
            </Link>
            <Link className="public-guide-link" href="/login">
              Sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export function GuideOverviewView() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;
  const { status, session, error, signOut, isSigningOut } = useAuthSession();

  const handleNavClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
      // Keep the hash in the URL for shareable deep-links without a jump.
      window.history.replaceState(null, "", `#${id}`);
    },
    [reduced],
  );

  async function handleLogout() {
    // Non-fatal on failure: the nav still offers a retry.
    await signOut();
    router.push("/");
  }

  if (status === "loading") {
    return <PipelineLoader label="Loading Guide" />;
  }

  if (status !== "signed-in") {
    return <PublicGuidePage error={status === "error" ? error : null} />;
  }

  const guest = isGuest(session);

  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#guide-main" className="skip-link">
        Skip to guide content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isSigningOut}
      />

      <div id="guide-main" style={{ padding: 0 }}>
        {/* Header band */}
        <motion.div
          className="workflow-page-header workflow-page-header--compact"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <div className="workflow-page-header-left">
            <p className="workflow-page-breadcrumb">
              <span style={{ opacity: 0.55 }}>ALPHACI</span>
              <span className="workflow-page-breadcrumb-sep">/</span>
              <span>Guide</span>
            </p>
            <div className="workflow-page-title-row">
              <h1 className="workflow-page-title">How to use ALPHACI</h1>
            </div>
          </div>
        </motion.div>

        {/* Two-column: sticky TOC + content */}
        <div className="guide-layout">
          <nav className="guide-toc" aria-label="Guide contents">
            <p className="guide-toc-label">On this page</p>
            <ul>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={(e) => handleNavClick(e, s.id)}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
            <Link
              href="/workflows?tour=1"
              className="primary-button"
              style={{
                marginTop: "1rem",
                width: "100%",
                justifyContent: "center",
                fontSize: "0.82rem",
              }}
              aria-label="Replay the guided product tour on the Projects page"
            >
              Replay guided tour
            </Link>
          </nav>

          <div className="guide-content">
            <GuideCard
              id="welcome"
              index={0}
              title="What is ALPHACI"
              reduced={reduced}
            >
              <p>
                ALPHACI turns a blank idea into a working repository in one
                step. It creates a GitHub repository, sets up the{" "}
                <code>main</code>, <code>uat</code>, and <code>test</code>{" "}
                branches, scaffolds a starter project, and commits a
                ready-to-run CI/CD pipeline — so you can start coding
                immediately instead of wiring up infrastructure.
              </p>
            </GuideCard>

            <GuideCard
              id="getting-started"
              index={1}
              title="Getting started"
              reduced={reduced}
            >
              <ol>
                <li>
                  <strong>Sign in</strong> with your GitHub account from the
                  login page.
                </li>
                <li>
                  <strong>Install the GitHub App.</strong> On the Projects
                  page, if you see an
                  <em> &ldquo;Install GitHub App&rdquo;</em> chip, click it and
                  grant access to the repositories (or organisation) you want
                  ALPHACI to manage. This is what lets ALPHACI create repos and
                  commit workflows on your behalf.
                </li>
                <li>
                  <strong>Open Projects</strong> and head to the{" "}
                  <strong>Setup</strong> tab to create your first project.
                </li>
              </ol>
            </GuideCard>

            <GuideCard
              id="creating-a-project"
              index={2}
              title="Creating a project"
              reduced={reduced}
            >
              <p>The Setup form walks top to bottom. Each field:</p>
              <ul>
                <li>
                  <strong>Repository shape</strong> — how the project is
                  organised (see the three shapes below).
                </li>
                <li>
                  <strong>Language &amp; framework</strong> — your stack, e.g.
                  NestJS or Next.js. This tailors the CI jobs.
                </li>
                <li>
                  <strong>Workflow recipe</strong> — a preset bundle of CI jobs.{" "}
                  <em>Standard</em> suits most teams.
                </li>
                <li>
                  <strong>Repository name</strong> — your GitHub repo name.
                  Lowercase, hyphen-separated, e.g.{" "}
                  <code>my-first-service</code>.
                </li>
                <li>
                  <strong>Visibility</strong> — private (collaborators only) or
                  public.
                </li>
                <li>
                  <strong>Service name &amp; path</strong> — an identifier used
                  in the workflow YAML, and where the service lives (
                  <code>.</code> for root).
                </li>
                <li>
                  <strong>Node version</strong> — the Node.js version the CI
                  runner uses. Node 22 LTS is a safe default.
                </li>
                <li>
                  <strong>Coverage threshold</strong> — minimum test coverage
                  the pipeline enforces. 80% is a solid start.
                </li>
                <li>
                  <strong>Workflow checks</strong> — toggle individual CI jobs
                  on or off.
                </li>
              </ul>

              <p style={{ marginTop: "0.9rem" }}>
                <strong>Repository shapes — the difference:</strong>
              </p>
              <ul>
                <li>
                  <strong>Standalone</strong> — one app in one repository. Best
                  for a single service or app.
                </li>
                <li>
                  <strong>Microservices</strong> — one repository containing
                  both a backend and a frontend in separate sub-directories,
                  each with its own CI workflow.
                </li>
                <li>
                  <strong>Multi-repo</strong> — two separate GitHub repositories
                  (one backend, one frontend), each provisioned independently.
                </li>
              </ul>

              <div className="guide-callout">
                New here? Click <strong>Replay guided tour</strong> to walk the
                form field-by-field and create your first repository as you go.
              </div>
            </GuideCard>

            <GuideCard
              id="branch-strategy"
              index={3}
              title="Branch strategy"
              reduced={reduced}
            >
              <div style={{ marginBottom: "1rem" }}>
                <FlowExplainer heading={null} />
              </div>
              <p>
                Every repository ships with a strict promotion flow:{" "}
                <code>test &rarr; uat &rarr; main</code>. Changes always move
                forward — never backward. All three branches are protected, so
                you work on short-lived branches and open pull requests.
              </p>
              <ul>
                <li>
                  <code>feature/*</code> and <code>bugfix/*</code> merge into{" "}
                  <code>test</code>.
                </li>
                <li>
                  Merging into <code>test</code> auto-opens a PR to{" "}
                  <code>uat</code>; merging <code>uat</code> auto-opens a PR to{" "}
                  <code>main</code>.
                </li>
                <li>
                  <code>hotfix/*</code> merges into <code>main</code> with a
                  mandatory back-merge.
                </li>
              </ul>
              <p style={{ marginTop: "0.7rem" }}>
                Commits follow Conventional Commits:
              </p>
              <pre className="guide-code">
                <code>{`feat: add user onboarding tour
fix: correct coverage threshold parsing
chore: bump node to 22 LTS
docs: update the guide page`}</code>
              </pre>
            </GuideCard>

            <GuideCard
              id="quality-gates"
              index={4}
              title="CI/CD quality gates"
              reduced={reduced}
            >
              <div style={{ marginBottom: "1rem" }}>
                <FlowExplainer heading={null} variant="compact" />
              </div>
              <p>
                The <strong>Quality</strong> stage above is where these specific
                checks run, gating every promotion:
              </p>
              <ul>
                <li>
                  <strong>Lint</strong> — zero errors.
                </li>
                <li>
                  <strong>TypeScript</strong> — strict mode,{" "}
                  <code>tsc --noEmit</code> passes.
                </li>
                <li>
                  <strong>Unit tests</strong> — 100% pass rate, coverage at or
                  above your threshold.
                </li>
                <li>
                  <strong>Security scan</strong> — no high or critical
                  vulnerabilities on <code>uat</code>/<code>main</code>.
                </li>
                <li>
                  <strong>E2E + k6 gate</strong> — a required status check on{" "}
                  <code>test</code> and <code>uat</code>.
                </li>
              </ul>
            </GuideCard>

            <GuideCard
              id="managing-projects"
              index={5}
              title="Managing your projects"
              reduced={reduced}
            >
              <ul>
                <li>
                  <strong>Current Projects tab</strong> — every repository you
                  have provisioned, with quick links to the repo, its Actions,
                  and the latest commit, plus your generated YAML history.
                </li>
                <li>
                  <strong>Catalog tab</strong> — browse all available workflow
                  templates and send one straight into the Setup form with{" "}
                  <em>Use in Create Project</em>.
                </li>
              </ul>
            </GuideCard>

            <GuideCard
              id="faq"
              index={6}
              title="FAQ & troubleshooting"
              reduced={reduced}
            >
              <FaqItem q="Why can't I see the catalog or project options?">
                The most common cause is not being signed in, or the GitHub App
                not being installed yet. Sign in, install the GitHub App from
                the Projects page, then reload.
              </FaqItem>
              <FaqItem q="How do I replay the guided tour?">
                Click <strong>Replay guided tour</strong> on this page, or the{" "}
                <strong>Show guide</strong> button on the Projects Setup tab.
                The tour walks every field and ends at the Create button.
              </FaqItem>
              <FaqItem q="What's the difference between Microservices and Multi-repo?">
                Microservices keeps backend and frontend together in{" "}
                <em>one</em> repository (separate folders, separate workflows).
                Multi-repo creates <em>two</em> separate GitHub repositories.
                Choose multi-repo when the services are deployed and versioned
                fully independently.
              </FaqItem>
              <FaqItem q="Can I change settings after creating a repository?">
                Yes. Visibility and branch settings can be changed in GitHub,
                and you can regenerate the workflow with new checks at any time
                from the Setup tab.
              </FaqItem>
            </GuideCard>

            {guest ? (
              <div
                className="section-card glass-panel"
                style={{ padding: "1.4rem 1.6rem", textAlign: "center" }}
              >
                <p style={{ marginBottom: "0.9rem" }}>
                  Ready to create your first repository?
                </p>
                <Link className="primary-button" href="/signup">
                  Sign up free
                </Link>
              </div>
            ) : (
              <div
                className="section-card glass-panel"
                style={{ padding: "1.4rem 1.6rem", textAlign: "center" }}
              >
                <p style={{ marginBottom: "0.9rem" }}>Ready to build?</p>
                <Link className="primary-button" href="/workflows">
                  Go to Projects
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

