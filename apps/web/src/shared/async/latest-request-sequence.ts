'use client';

import { useEffect, useState } from 'react';

export interface LatestRequestLease {
  isCurrent(): boolean;
  cancel(): void;
}

/**
 * Coordinates requests for one resource: starting a new request makes earlier
 * leases stale, and cancelling a lease only invalidates that request.
 */
export class LatestRequestSequence {
  private generation = 0;

  begin(): LatestRequestLease {
    const generation = ++this.generation;
    let active = true;

    return {
      isCurrent: () => active && this.generation === generation,
      cancel: () => {
        if (!active) return;
        active = false;
        if (this.generation === generation) this.generation += 1;
      },
    };
  }

  invalidate(): void {
    this.generation += 1;
  }
}

/** One latest-request channel, invalidated when its owning component unmounts. */
export function useLatestRequestSequence(): LatestRequestSequence {
  const [sequence] = useState(() => new LatestRequestSequence());
  useEffect(() => () => sequence.invalidate(), [sequence]);
  return sequence;
}
