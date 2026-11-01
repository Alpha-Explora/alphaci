"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type {
  ChecklistItemDraft,
  ChecklistTargetPersona,
  ChecklistVerificationType,
} from "../../model/checklist-types";
import {
  CHECKLIST_ITEM_TITLE_MAX,
  TARGET_PERSONA_OPTIONS,
  VERIFICATION_TYPE_OPTIONS,
  needsTestIdentifier,
  testIdentifierPlaceholder,
} from "../../model/checklist-rules";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, RemoveIcon } from "./checklist-icons";

type ItemPatch = Partial<Omit<ChecklistItemDraft, "key">>;

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

function RowControls({
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: Readonly<{
  index: number;
  count: number;
  disabled: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}>) {
  const n = index + 1;
  return (
    <div className="qa-edit-item__controls">
      <button
        type="button"
        className="qa-icon-btn"
        aria-label={`Move item ${n} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUpIcon />
      </button>
      <button
        type="button"
        className="qa-icon-btn"
        aria-label={`Move item ${n} down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDownIcon />
      </button>
      <button
        type="button"
        className="qa-icon-btn qa-icon-btn--danger"
        aria-label={`Remove item ${n}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

function ItemFields({
  item,
  index,
  disabled,
  onChange,
}: Readonly<{
  item: ChecklistItemDraft;
  index: number;
  disabled: boolean;
  onChange: (patch: ItemPatch) => void;
}>) {
  const n = index + 1;
  const showTest = needsTestIdentifier(item.verificationType);
  return (
    <div className="qa-edit-item__grid">
      <label className="hier-field qa-edit-item__field">
        <span className="hier-field-label">Who runs it</span>
        <select
          className="hier-select"
          value={item.targetPersona}
          disabled={disabled}
          aria-label={`Who runs item ${n}`}
          onChange={(event) =>
            onChange({ targetPersona: event.target.value as ChecklistTargetPersona })
          }
        >
          {TARGET_PERSONA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="hier-field qa-edit-item__field">
        <span className="hier-field-label">Verified by</span>
        <select
          className="hier-select"
          value={item.verificationType}
          disabled={disabled}
          aria-label={`How item ${n} is verified`}
          onChange={(event) =>
            onChange({ verificationType: event.target.value as ChecklistVerificationType })
          }
        >
          {VERIFICATION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {showTest ? (
        <label className="hier-field qa-edit-item__field qa-edit-item__field--wide">
          <span className="hier-field-label">Test identifier</span>
          <input
            className="hier-input qa-mono-input"
            value={item.testIdentifier}
            disabled={disabled}
            placeholder={testIdentifierPlaceholder(item.verificationType)}
            aria-label={`Test identifier for item ${n}`}
            onChange={(event) => onChange({ testIdentifier: event.target.value })}
          />
        </label>
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  index,
  count,
  error,
  disabled,
  onChange,
  onMove,
  onRemove,
}: Readonly<{
  item: ChecklistItemDraft;
  index: number;
  count: number;
  error: string | undefined;
  disabled: boolean;
  onChange: (patch: ItemPatch) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}>) {
  const n = index + 1;
  return (
    <div className={`qa-edit-item${error ? " qa-edit-item--invalid" : ""}`}>
      <span className="qa-item__pos" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <div className="qa-edit-item__body">
        <div className="qa-edit-item__top">
          <input
            className="hier-input qa-edit-item__title"
            value={item.title}
            disabled={disabled}
            maxLength={CHECKLIST_ITEM_TITLE_MAX}
            placeholder="What must be true? e.g. Checkout works with a saved card"
            aria-label={`Item ${n} title`}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <RowControls
            index={index}
            count={count}
            disabled={disabled}
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
        <ItemFields item={item} index={index} disabled={disabled} onChange={onChange} />
        <textarea
          className="hier-textarea qa-edit-item__desc"
          rows={2}
          value={item.description}
          disabled={disabled}
          placeholder="Steps or acceptance notes (optional)"
          aria-label={`Item ${n} notes`}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        {error ? (
          <p className="qa-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The ordered item list, editable. Order is meaningful — it is the order
 * people work through the checks — so reordering is explicit up/down rather
 * than drag, which is keyboard-reachable and cannot drop in the wrong place.
 */
export function ChecklistItemsEditor({
  items,
  itemErrors,
  disabled,
  onAdd,
  onChange,
  onMove,
  onRemove,
}: Readonly<{
  items: ChecklistItemDraft[];
  itemErrors: Record<string, string>;
  disabled: boolean;
  onAdd: () => void;
  onChange: (key: string, patch: ItemPatch) => void;
  onMove: (index: number, delta: number) => void;
  onRemove: (key: string) => void;
}>) {
  const reduced = useReducedMotion();
  return (
    <div className="qa-edit-items">
      {items.length === 0 ? (
        <p className="qa-items-empty">
          No items yet. Add the first check people should run before this ships.
        </p>
      ) : (
        <ol className="qa-edit-items__list">
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <motion.li
                key={item.key}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <ItemRow
                  item={item}
                  index={index}
                  count={items.length}
                  error={itemErrors[item.key]}
                  disabled={disabled}
                  onChange={(patch) => onChange(item.key, patch)}
                  onMove={(delta) => onMove(index, delta)}
                  onRemove={() => onRemove(item.key)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      <button type="button" className="qa-add-item" disabled={disabled} onClick={onAdd}>
        <PlusIcon />
        Add item
      </button>
    </div>
  );
}
