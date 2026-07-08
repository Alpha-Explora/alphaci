import { Suspense } from "react";

import { OAuthAuthPage } from "@/components/auth/oauth-auth-page";
import { PipelineLoader } from "@/components/layout/pipeline-loader";

export default function LoginPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Preparing your sign in" />}>
      <OAuthAuthPage
        mode="login"
        title="Sign in to ALPHACI."
        subtitle="Use your company GitHub account. Access opens only after ALPHACI organization membership is confirmed."
      />
    </Suspense>
  );
}
