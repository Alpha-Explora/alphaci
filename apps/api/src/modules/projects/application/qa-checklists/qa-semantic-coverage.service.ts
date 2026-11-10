import { Injectable } from '@nestjs/common';

import {
  assessStoryCoverage,
  summarizeCoverage,
  type CoverageSummary,
  type StoryCoverage,
} from '../../domain/semantic-coverage.rules';
import { QaRequirementsService } from './qa-requirements.service';

/** GET /delivery-projects/:id/semantic-coverage */
export interface ProjectSemanticCoverage {
  deliveryProjectId: string;
  generatedAt: string;
  /** How outcomes are matched, for the screen to say plainly. */
  method: 'keyword-overlap';
  thresholds: { covered: number; weak: number };
  summary: CoverageSummary;
  features: Array<{
    requirementId: string;
    name: string;
    stories: StoryCoverage[];
  }>;
}

/**
 * Semantic test coverage of a Project's active Iteration: every User story's
 * acceptance criteria against its QA test cases (semantic-coverage.rules.ts).
 * Read-only, for anyone who can see the Project; it changes nothing and
 * gates nothing.
 */
@Injectable()
export class QaSemanticCoverageService {
  constructor(private readonly requirements: QaRequirementsService) {}

  async forProject(
    deliveryProjectId: string,
    userId: string,
  ): Promise<ProjectSemanticCoverage> {
    const list = await this.requirements.listForProject(
      deliveryProjectId,
      userId,
      {
        kind: 'functional',
        includeArchived: false,
      },
    );
    const features = list.requirements.map((requirement) => ({
      requirementId: requirement.id,
      name: requirement.name,
      stories: requirement.items.map((item) =>
        assessStoryCoverage({
          itemId: item.id,
          title: item.title,
          acceptanceCriteria: item.acceptanceCriteria,
          testCases: item.testCategories.flatMap((category) =>
            category.testCases.map((testCase) => ({
              id: testCase.id,
              title: testCase.title,
              expectedResult: testCase.expectedResult,
            })),
          ),
        }),
      ),
    }));
    return {
      deliveryProjectId,
      generatedAt: new Date().toISOString(),
      method: 'keyword-overlap',
      thresholds: { covered: 0.6, weak: 0.3 },
      summary: summarizeCoverage(
        features.flatMap((feature) => feature.stories),
      ),
      features,
    };
  }
}
