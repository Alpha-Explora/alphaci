'use client';

import { formatDate } from '@/features/workflows';
import type { RunsResponse } from '@/shared/api/contracts';

export function CiRunsList({
  response,
}: Readonly<{ response: RunsResponse | null }>) {
  if (!response) {
    return <p className="env-empty-state">Loading CI runs...</p>;
  }

  if (!response.runs.length) {
    return <p className="env-empty-state">No CI runs tracked yet.</p>;
  }

  return (
    <div className="env-metadata-list">
      {response.runs.map((run) => (
        <div
          key={JSON.stringify([run.branch, run.commitSha, run.runId])}
          className="env-metadata-row"
        >
          <span>
            <strong>{run.branch}</strong> ·{' '}
            <code>{run.commitSha.slice(0, 12)}</code>
          </span>
          <small>
            {formatDate(run.startedAt)} · {run.overallStatus}
          </small>
        </div>
      ))}
    </div>
  );
}
