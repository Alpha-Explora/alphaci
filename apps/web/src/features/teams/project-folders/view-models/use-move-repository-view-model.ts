'use client';

import { useState } from 'react';

import { projectFoldersRepository } from '../data/project-folders-repository';
import {
  accessLossFrom,
  isConflict,
  moveErrorMessage,
} from '../model/project-folder-rules';
import type {
  FolderRepository,
  MoveAccessLoss,
  ProjectFolder,
} from '../model/project-folder-types';

/** "saving" while the move is in flight, "archiving" while an emptied Project is archived. */
export type MoveRepositoryStatus = 'idle' | 'saving' | 'archiving' | 'error';

/** What the explorer tells the lead once a move lands. */
export interface MoveNotice {
  text: string;
  /** Set when the move left its old Project with no repositories. */
  emptied: { deliveryProjectId: string; name: string } | null;
}

export interface MoveRepositoryViewModel {
  status: MoveRepositoryStatus;
  error: string | null;
  /**
   * Set when the move would remove GitHub Write from people outside the other
   * Project. The dialog lists them; submitting again is the lead's agreement.
   */
  accessLoss: MoveAccessLoss | null;
  /** The repository whose Move dialog is open, or null. */
  repository: FolderRepository | null;
  source: ProjectFolder | null;
  targetId: string;
  notice: MoveNotice | null;
  openFor: (repository: FolderRepository, source: ProjectFolder) => void;
  close: () => void;
  setTargetId: (deliveryProjectId: string) => void;
  submit: (targets: ReadonlyArray<ProjectFolder>) => Promise<void>;
  archiveEmptied: () => Promise<void>;
  dismissNotice: () => void;
}

function movedText(
  repository: FolderRepository,
  target: ProjectFolder | undefined,
): string {
  return `Moved ${repository.name} to ${target?.name ?? 'the other Project'}.`;
}

/**
 * ViewModel for "Move to another Project".
 *
 * A 409 means someone else moved the repository first: the dialog says so and
 * the explorer refetches, so the lead sees where it actually is now.
 */
export function useMoveRepositoryViewModel(options: {
  /** Refetch the explorer: after a move, a conflict, or an archive. */
  onChanged: () => void;
}): MoveRepositoryViewModel {
  const { onChanged } = options;
  const [repository, setRepository] = useState<FolderRepository | null>(null);
  const [source, setSource] = useState<ProjectFolder | null>(null);
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState<MoveRepositoryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<MoveNotice | null>(null);
  const [accessLoss, setAccessLoss] = useState<MoveAccessLoss | null>(null);

  async function submit(targets: ReadonlyArray<ProjectFolder>) {
    if (!repository || !source || !targetId || status === 'saving') return;
    setStatus('saving');
    setError(null);
    try {
      const outcome = await projectFoldersRepository.moveRepository(
        repository.repositoryId,
        targetId,
        accessLoss !== null,
      );
      const target = targets.find(
        (folder) => folder.deliveryProjectId === targetId,
      );
      setNotice({
        text: movedText(repository, target),
        emptied: outcome.sourceDeliveryProjectEmpty
          ? {
              deliveryProjectId:
                outcome.sourceDeliveryProjectId ?? source.deliveryProjectId,
              name: source.name,
            }
          : null,
      });
      setStatus('idle');
      setRepository(null);
      setAccessLoss(null);
      onChanged();
    } catch (cause) {
      const loss = accessLossFrom(cause);
      if (loss) {
        // Not a failure: the lead decides, and submitting again agrees.
        setAccessLoss(loss);
        setStatus('idle');
        return;
      }
      setStatus('error');
      setError(moveErrorMessage(cause));
      if (isConflict(cause)) onChanged();
    }
  }

  async function archiveEmptied() {
    const emptied = notice?.emptied;
    if (!emptied || status === 'archiving') return;
    setStatus('archiving');
    try {
      await projectFoldersRepository.archive(emptied.deliveryProjectId);
      setNotice({ text: `Archived ${emptied.name}.`, emptied: null });
      setStatus('idle');
      onChanged();
    } catch {
      setStatus('error');
      setNotice({
        text: `${emptied.name} could not be archived. Try again in a moment.`,
        emptied,
      });
    }
  }

  return {
    status,
    error,
    accessLoss,
    repository,
    source,
    targetId,
    notice,
    openFor: (next, from) => {
      setRepository(next);
      setSource(from);
      setTargetId('');
      setError(null);
      setAccessLoss(null);
      setStatus('idle');
    },
    close: () => {
      if (status !== 'saving') {
        setRepository(null);
        setAccessLoss(null);
      }
    },
    // Who loses access depends on the destination, so a new pick asks again.
    setTargetId: (deliveryProjectId) => {
      setTargetId(deliveryProjectId);
      setAccessLoss(null);
      setError(null);
    },
    submit,
    archiveEmptied,
    dismissNotice: () => setNotice(null),
  };
}
