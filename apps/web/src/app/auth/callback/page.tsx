import { Suspense } from "react";

import { PipelineLoader } from "@/components/layout/pipeline-loader";

import { AuthCallbackClient } from "./callback-client";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<PipelineLoader label="Completing authentication" />}>
      <AuthCallbackClient />
    </Suspense>
  );
}
