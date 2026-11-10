'use client';

import type { AppRole } from '@/shared/api/contracts';
import type { QaScope } from '../../model/qa-scope';
import { useQaPromotionViewModel } from '../view-models/use-qa-promotion-view-model';
import { usePoDeliveryViewModel } from '../view-models/use-po-delivery-view-model';
import { PromotionCard } from './promotion-card';
import { PromotionBarFoot, StudioMergeAction } from './promotion-bar';
import { MergeAllDialog, MergeAllOutcome } from './po-delivery';

/** Developer release controls reuse the studios' server-checked promotion flow. */
export function ProductionReadinessCard({
  projectId,
  enabled,
  appRole,
  qaScope,
}: Readonly<{
  projectId: string;
  enabled: boolean;
  appRole?: AppRole | null;
  qaScope?: QaScope;
}>) {
  const promotion = useQaPromotionViewModel({
    projectId,
    enabled,
    appRole,
    watch: null,
  });
  const deliveryProjectId =
    qaScope?.kind === 'project'
      ? qaScope.deliveryProjectId
      : (promotion.data?.deliveryProject?.id ?? null);
  const projectName = promotion.data?.deliveryProject?.name ?? 'Project';
  const delivery = usePoDeliveryViewModel({
    deliveryProjectId,
    enabled: enabled && Boolean(deliveryProjectId),
    projectId,
    appRole,
    promotion,
  });
  return (
    <>
      <PromotionCard
        vm={promotion}
        action={<StudioMergeAction promotion={promotion} delivery={delivery} />}
      />
      <PromotionBarFoot vm={promotion} projectName={projectName}>
        <MergeAllOutcome vm={delivery} />
      </PromotionBarFoot>
      <MergeAllDialog vm={delivery} projectName={projectName} />
    </>
  );
}
