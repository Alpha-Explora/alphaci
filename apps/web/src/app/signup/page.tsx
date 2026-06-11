import { Suspense } from "react";

import { OAuthAuthPage } from "@/components/auth/oauth-auth-page";
import { PipelineLoader } from "@/components/layout/pipeline-loader";

export default function SignupPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Preparing your sign up" />}>
      <OAuthAuthPage
        mode="signup"
        title="Create your workflow workspace"
        subtitle="Sign up with GitHub and start generating workflows right away."
        switchText="Already have an account?"
        switchHref="/login"
        switchCta="Log in"
      />
    </Suspense>
  );
}
