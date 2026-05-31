import { Suspense } from "react";

import { OAuthAuthPage } from "@/components/auth/oauth-auth-page";
import { FlowBackground } from "@/components/layout/flow-background";

function LoginFallback() {
  return (
    <main className="flow-shell page-shell auth-shell">
      <FlowBackground />
      <section className="section-card auth-card glass-panel">
        <p className="hero-kicker">OAuth Login</p>
        <h1>Loading login page</h1>
        <p className="helper-text">Preparing your secure sign in route.</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <OAuthAuthPage
        mode="login"
        title="Sign in to your pipeline workspace."
        subtitle="Choose Google or GitHub to continue to Create Project."
        switchText="New here?"
        switchHref="/signup"
        switchCta="Create your account"
      />
    </Suspense>
  );
}
