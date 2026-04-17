import { Suspense } from "react";

import { GitHubAuthPage } from "@/components/auth/github-auth-page";
import { FlowBackground } from "@/components/layout/flow-background";

function SignupFallback() {
  return (
    <main className="flow-shell page-shell auth-shell">
      <FlowBackground />
      <section className="section-card auth-card glass-panel">
        <p className="hero-kicker">GitHub Sign Up</p>
        <h1>Loading sign up page</h1>
        <p className="helper-text">Preparing your secure registration route.</p>
      </section>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <GitHubAuthPage
        mode="signup"
        title="Create your workflow workspace"
        subtitle="Sign up with GitHub and start generating workflows right away."
        primaryCta="Sign up with GitHub"
        switchText="Already have an account?"
        switchHref="/login"
        switchCta="Log in"
      />
    </Suspense>
  );
}
