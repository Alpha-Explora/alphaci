import type { ProjectSemanticCoverage } from '@/shared/api/contracts';
import { request } from '@/shared/api/request';

import { normalizeSemanticCoverage } from '../model/semantic-coverage-rules';
import type { SemanticCoverage } from '../model/semantic-coverage-types';

export const semanticCoverageRepository = {
  async forProject(deliveryProjectId: string): Promise<SemanticCoverage> {
    return normalizeSemanticCoverage(
      await request<ProjectSemanticCoverage>(
        `/delivery-projects/${encodeURIComponent(deliveryProjectId)}/semantic-coverage`,
      ),
    );
  },
};
