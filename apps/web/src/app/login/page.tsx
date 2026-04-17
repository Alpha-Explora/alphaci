import { Suspense } from "react";

import { GitHubAuthPage } from "@/components/auth/github-auth-page";
import { FlowBackground } from "@/components/layout/flow-background";

function LoginFallback() {
  return (
    <main className="flow-shell page-shell auth-shell">
      <FlowBackground />
      <section className="section-card auth-card glass-panel">
        <p className="hero-kicker">GitHub Login</p>
        <h1>Loading login page</h1>
        <p className="helper-text">Preparing your secure sign in route.</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <GitHubAuthPage
        mode="login"
        title="Welcome back"
        subtitle="Sign in with GitHub to continue to your workflow studio."
        primaryCta="Continue with GitHub"
        switchText="New here?"
        switchHref="/signup"
        switchCta="Create your account"
      />
    </Suspense>
  );
}
