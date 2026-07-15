import { Suspense } from "react";

import { OAuthAuthPage } from "@/components/auth/oauth-auth-page";
import { PipelineLoader } from "@/components/layout/pipeline-loader";

export default function LoginPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Preparing your sign in" />}>
      <OAuthAuthPage
        mode="login"
        title="Sign in to Alphaexplora."
        subtitle="Internal access for the Alphaexplora team. Use your company GitHub account — the door opens only after your Alphaexplora organization membership is confirmed."
      />
    </Suspense>
  );
}
