'use client';

import { useCallback, useRef, useState } from 'react';

import { semanticCoverageRepository } from '../../data/semantic-coverage-repository';
import type { SemanticCoverage } from '../../model/semantic-coverage-types';
import { errorStatus } from '../../model/wire-readers';

export type SemanticCoverageStatus =
  'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface SemanticCoverageViewModel {
  status: SemanticCoverageStatus;
  coverage: SemanticCoverage | null;
  showCovered: boolean;
  setShowCovered: (show: boolean) => void;
  /** Reads on first open; later opens keep what was read until Read again. */
  open: () => void;
  reload: () => Promise<void>;
}

/** Read-only and on demand: nothing is fetched until the card is opened. */
export function useSemanticCoverageViewModel(
  deliveryProjectId: string,
): SemanticCoverageViewModel {
  const [status, setStatus] = useState<SemanticCoverageStatus>('idle');
  const [coverage, setCoverage] = useState<SemanticCoverage | null>(null);
  const [showCovered, setShowCovered] = useState(false);
  const loading = useRef(false);

  const reload = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setStatus('loading');
    try {
      setCoverage(
        await semanticCoverageRepository.forProject(deliveryProjectId),
      );
      setStatus('ready');
    } catch (cause) {
      setStatus(errorStatus(cause) === 404 ? 'unavailable' : 'error');
    } finally {
      loading.current = false;
    }
  }, [deliveryProjectId]);

  return {
    status,
    coverage,
    showCovered,
    setShowCovered,
    open: () => {
      if (status === 'idle') void reload();
    },
    reload,
  };
}
