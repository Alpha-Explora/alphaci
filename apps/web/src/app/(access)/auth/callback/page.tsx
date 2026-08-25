import { Suspense } from "react";

import { PipelineLoader } from "@/shared/layout/pipeline-loader";

import { AuthCallbackView } from "@/features/auth/callback";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Completing authentication" />}>
      <AuthCallbackView />
    </Suspense>
  );
}
