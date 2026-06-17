import { Suspense } from "react";

import { OAuthAuthPage } from "@/components/auth/oauth-auth-page";
import { PipelineLoader } from "@/components/layout/pipeline-loader";

export default function LoginPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Preparing your sign in" />}>
      <OAuthAuthPage
        mode="login"
        title="Sign in to your AlphaCI workspace."
        subtitle="Connect GitHub to keep building, exporting, and deploying workflows."
        switchText="New here?"
        switchHref="/signup"
        switchCta="Create your account"
      />
    </Suspense>
  );
}
