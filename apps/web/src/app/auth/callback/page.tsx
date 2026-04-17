import { Suspense } from "react";

import { FlowBackground } from "@/components/layout/flow-background";

import { AuthCallbackClient } from "./callback-client";

function CallbackFallback() {
  return (
    <main className="flow-shell page-shell">
      <FlowBackground />
      <section className="section-card callback-card glass-panel">
        <p className="hero-kicker">GitHub Login</p>
        <h1>Completing authentication</h1>
        <p>Finalizing your session...</p>
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackClient />
    </Suspense>
  );
}
