"use client";

import "./clone-card.css";

import { useId, useState, type KeyboardEvent } from "react";

import {
  CLONE_METHODS,
  cloneMethodOption,
  cloneNoun,
  cloneValue,
  nextCloneMethodIndex,
  type CloneMethod,
} from "../model/clone-rules";

function CopyIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="m4.5 6 2 2-2 2M8.5 10.5h3" />
    </svg>
  );
}

/**
 * "Clone" in the project header on Overview, as GitHub offers it: HTTPS, SSH
 * or the GitHub CLI, one read-only field and a copy button. Users never open
 * GitHub, so this is where a Developer gets the address to clone from. No
 * card of its own: it sits beside the title.
 */
export function CloneCard({
  repoFullName,
  repoUrl,
}: Readonly<{ repoFullName: string; repoUrl?: string | null }>) {
  const [method, setMethod] = useState<CloneMethod>("https");
  const [copied, setCopied] = useState(false);
  const baseId = useId();
  const value = cloneValue(method, repoFullName, repoUrl);
  if (!cloneValue("https", repoFullName, repoUrl)) return null;

  const option = cloneMethodOption(method);
  const noun = cloneNoun(method);
  const copyLabel = copied ? "Copied" : `Copy ${noun} to clipboard`;
  const tabId = (id: CloneMethod) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;

  function choose(next: CloneMethod) {
    setMethod(next);
    setCopied(false);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextCloneMethodIndex(index, event.key);
    if (next === null) return;
    event.preventDefault();
    const target = CLONE_METHODS[next];
    choose(target.id);
    document.getElementById(tabId(target.id))?.focus();
  }

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard permission can be refused; the value is on screen and
      // selectable, so there is nothing to escalate.
    }
  }

  return (
    <section className="clone-card" aria-labelledby={`${baseId}-title`}>
      <div className="clone-card__head">
        <h2 className="clone-card__title" id={`${baseId}-title`}>
          <TerminalIcon />
          Clone
        </h2>
        <div className="clone-card__tabs" role="tablist" aria-label="Clone with">
          {CLONE_METHODS.map((entry, index) => (
            <button
              key={entry.id}
              id={tabId(entry.id)}
              type="button"
              role="tab"
              className="clone-card__tab"
              aria-selected={entry.id === method}
              aria-controls={panelId}
              tabIndex={entry.id === method ? 0 : -1}
              onClick={() => choose(entry.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={tabId(method)} className="clone-card__panel">
        <div className="clone-card__field">
          <input
            className="clone-card__input"
            readOnly
            value={value ?? ""}
            aria-label={`${option.label} clone ${noun}`}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="clone-card__copy"
            data-copied={copied ? "true" : undefined}
            aria-label={copyLabel}
            title={copyLabel}
            onClick={() => void copy()}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <p className="clone-card__hint">{option.hint}</p>
        <span className="clone-card__status" role="status" aria-live="polite">
          {copied ? "Copied to clipboard" : ""}
        </span>
      </div>
    </section>
  );
}
