"use client";

import { useQaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { PromotionCard } from "./promotion-card";

/**
 * The "Ready for production" card with no actions: no Merge button and no
 * link into QA Studio. The project Overview shows it to Developers, who can
 * see whether uat is approved for main but neither merge it nor open the
 * Studio. The role is pinned to `member` so the card can never offer a merge,
 * whatever the caller's session says; the server gates the merge regardless.
 */
export function ProductionReadinessCard({
  projectId,
  projectName,
  enabled,
}: Readonly<{ projectId: string; projectName: string; enabled: boolean }>) {
  const vm = useQaPromotionViewModel({
    projectId,
    enabled,
    appRole: "member",
    watch: null,
  });
  return <PromotionCard vm={vm} projectName={projectName} />;
}
