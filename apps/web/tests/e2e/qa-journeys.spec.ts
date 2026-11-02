import { test } from '@playwright/test';

import { JOURNEYS, runJourney } from './qa-journeys';

/* One test per QA journey (qa-journeys.ts). Filter with -g "qa:b". */

/**
 * Journeys written for the QA flow before the 2026-10-19/20 redesign (test
 * cases under each User story, the test suite editor, PO Studio). They fail
 * on screens that no longer exist; each is rewritten for the current flow
 * and removed from this list.
 */
const STALE = new Set(['a', 'b', 'c', 'f', 'g', 'k', 'l', 'n', 'o']);

for (const journey of JOURNEYS) {
  test(`qa:${journey.id} ${journey.title}`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.fixme(
      STALE.has(journey.id),
      'Written for the QA flow before the 2026-10-19/20 redesign',
    );
    await runJourney({ page, context, baseURL: baseURL! }, journey);
  });
}
