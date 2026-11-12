'use client';

import { useId } from 'react';

import { FormDialog } from '@/features/groups/workspace';

import {
  OVERRIDE_REASON_MIN_LENGTH,
  PROMOTION_TARGET_BRANCH,
} from '../../model/qa-promotion-rules';
import type { QaPromotionStatus } from '../../model/qa-promotion-types';
import type { QaPromotionViewModel } from '../view-models/use-qa-promotion-view-model';

/**
 * "Override gate", beside Merge to main while the gate is closed, only for
 * admins and holders of deployment override. It never merges on one click:
 * the dialog names every check being skipped and asks why.
 */
export function OverrideToMain({ vm }: Readonly<{ vm: QaPromotionViewModel }>) {
  if (!vm.canOverride) return null;
  return (
    <button
      type="button"
      className="ghost-button qa-promo__override"
      disabled={vm.overrideState !== 'idle'}
      onClick={vm.openOverride}
    >
      {vm.overrideState === 'merging' ? 'Merging…' : 'Override gate…'}
    </button>
  );
}

/** The override confirmation: what is skipped, and a written reason that is audited. */
export function OverrideDialog({
  vm,
  data,
  projectName,
}: Readonly<{
  vm: QaPromotionViewModel;
  data: QaPromotionStatus;
  projectName: string;
}>) {
  const reasonId = useId();
  const hintId = useId();
  if (!vm.canOverride) return null;
  const enough = vm.overrideReason.trim().length >= OVERRIDE_REASON_MIN_LENGTH;
  return (
    <FormDialog
      open={vm.overrideState !== 'idle'}
      onClose={vm.cancelOverride}
      portal
      title={`Merge ${projectName} past the promotion gate?`}
      description={`This merges ${data.qaBranch} into ${PROMOTION_TARGET_BRANCH} although the checks below have not passed. Your reason is saved in the audit trail and every Product owner is notified.`}
      submitLabel="Override and merge"
      submitting={vm.overrideState === 'merging'}
      error={vm.overrideError}
      canSubmit={enough}
      onSubmit={() => void vm.confirmOverride()}
    >
      {data.reasons.length > 0 ? (
        <div className="qa-promo-override__skipped">
          <p className="qa-promo-confirm__note">Checks this skips:</p>
          <ul>
            {data.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="hier-field" htmlFor={reasonId}>
        <span className="hier-field-label">Why is this override needed?</span>
        <textarea
          id={reasonId}
          className="hier-input qa-promo-override__reason"
          rows={3}
          maxLength={1000}
          value={vm.overrideReason}
          aria-describedby={hintId}
          onChange={(event) => vm.setOverrideReason(event.target.value)}
        />
        <span id={hintId} className="hier-field-hint">
          At least {OVERRIDE_REASON_MIN_LENGTH} characters, for example the
          incident or ticket it fixes.
        </span>
      </label>
    </FormDialog>
  );
}
