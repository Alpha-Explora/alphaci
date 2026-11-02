import { test } from '@playwright/test';

import { JOURNEYS, runJourney } from './qa-journeys';

/* One test per QA journey (qa-journeys.ts). Filter with -g "qa:b". */

for (const journey of JOURNEYS) {
  test(`qa:${journey.id} ${journey.title}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await runJourney({ page, context, baseURL: baseURL! }, journey);
  });
}
