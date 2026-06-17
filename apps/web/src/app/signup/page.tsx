import { Suspense } from "react";

import { OAuthAuthPage } from "@/components/auth/oauth-auth-page";
import { PipelineLoader } from "@/components/layout/pipeline-loader";

export default function SignupPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Preparing your sign up" />}>
      <OAuthAuthPage
        mode="signup"
        title="Create your AlphaCI workspace."
        subtitle="Start with GitHub and generate your first governed workflow in minutes."
        switchText="Already have an account?"
        switchHref="/login"
        switchCta="Log in"
      />
    </Suspense>
  );
}
