"use client";
import { useState } from "react";
import type {
  EnrollmentReceipt,
  HostPlatform,
  MachineSummary,
  PlatformGuide,
} from "../model/host-types";
import {
  PLATFORM_GUIDES,
  countdownLabel,
  hostConnectionLabel,
  hostStatusTone,
  lastSeenLabel,
} from "../model/host-types";
import { enrollmentInstructions } from "../model/enrollment-instructions";
import type { useHostsViewModel } from "../view-models/use-hosts-view-model";
type HostsVm = ReturnType<typeof useHostsViewModel>;

const PLATFORMS: HostPlatform[] = ["windows", "ubuntu"];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="hosts-copy"
      aria-label={copied ? "Copied" : `Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1_800);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Name the machine", "Run the installer", "Machine connects"];
  return (
    <ol className="hosts-steps" aria-label="Add host progress">
      {steps.map((label, index) => {
        const step = index + 1;
        const state =
          step < current ? "done" : step === current ? "current" : "todo";
        return (
          <li
            key={label}
            className={`hosts-steps__item hosts-steps__item--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="hosts-steps__dot" aria-hidden="true">
              {state === "done" ? "✓" : step}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function AddHostForm({ vm }: { vm: HostsVm }) {
  return (
    <form
      className="hosts-panel"
      aria-label="Add a host"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.enroll();
      }}
    >
      <Steps current={1} />
      <label className="hosts-field">
        <span className="hosts-field__label">Machine name</span>
        <span className="hosts-field__hint">
          Something your team will recognise, like “Office server” or
          “eatta-prod-01”.
        </span>
        <input
          required
          autoFocus
          maxLength={80}
          value={vm.name}
          placeholder="e.g. Office server"
          onChange={(event) => vm.setName(event.target.value)}
        />
      </label>
      <fieldset className="hosts-field">
        <legend className="hosts-field__label">
          What operating system does it run?
        </legend>
        <div className="hosts-platforms">
          {PLATFORMS.map((id) => {
            const guide = PLATFORM_GUIDES[id];
            return (
              <label
                key={id}
                className={`hosts-platform${vm.platform === id ? " hosts-platform--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="host-platform"
                  value={id}
                  checked={vm.platform === id}
                  onChange={() => vm.setPlatform(id)}
                />
                <span className="hosts-platform__name">{guide.label}</span>
                <span className="hosts-platform__summary">{guide.summary}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="hosts-panel__actions">
        <button
          className="primary-button"
          disabled={vm.busy || !vm.name.trim()}
          type="submit"
        >
          {vm.busy ? "Creating…" : "Continue"}
        </button>
        <button className="ghost-button" type="button" onClick={vm.closeAdding}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The recommended path: one file that carries the code and cleans up after itself. */
function DownloadOption({ vm, guide }: { vm: HostsVm; guide: PlatformGuide }) {
  return (
    <div className="hosts-option">
      <div className="hosts-option__text">
        <p className="hosts-option__title">
          Download the installer{" "}
          <span className="hosts-option__badge">Recommended</span>
        </p>
        <p className="hosts-muted">{guide.fileRunIn}</p>
        <p className="hosts-option__note">
          The one-time code is inside the file, and the file deletes itself
          after a successful install.
          {guide.fileCopyNote ? ` ${guide.fileCopyNote}` : ""}
        </p>
      </div>
      <button
        className="primary-button"
        type="button"
        onClick={vm.downloadInstallFile}
      >
        Download install file
      </button>
    </div>
  );
}

/** The manual path: paste a command, then paste the code when it asks. */
function CommandSteps({
  receipt,
  guide,
  command,
}: {
  receipt: EnrollmentReceipt;
  guide: PlatformGuide;
  command: string;
}) {
  return (
    <ol className="hosts-substeps">
      <li>
        <p className="hosts-substeps__title">Run this command</p>
        <p className="hosts-muted">{guide.runIn}</p>
        <div className="hosts-code hosts-code--command">
          <pre>{command}</pre>
          <CopyButton value={command} label="install command" />
        </div>
      </li>
      <li>
        <p className="hosts-substeps__title">
          Paste this code when the installer asks for it
        </p>
        <div className="hosts-code hosts-code--secret">
          <pre>{receipt.code}</pre>
          <CopyButton value={receipt.code} label="enrollment code" />
        </div>
      </li>
    </ol>
  );
}

/** The file first when this installer version has one; otherwise the command. */
function InstallOptions({
  vm,
  receipt,
  guide,
  command,
}: {
  vm: HostsVm;
  receipt: EnrollmentReceipt;
  guide: PlatformGuide;
  command: string;
}) {
  return (
    <>
      {receipt.replacesMachineId ? (
        <p className="hosts-notice">
          This replaces the machine&apos;s credential. Run the installer on that
          machine; its current credential stops working once the code is used.
        </p>
      ) : null}
      {vm.canDownloadInstallFile ? (
        <>
          <DownloadOption vm={vm} guide={guide} />
          <details className="hosts-alt">
            <summary>Use a command instead</summary>
            <CommandSteps receipt={receipt} guide={guide} command={command} />
          </details>
        </>
      ) : (
        <CommandSteps receipt={receipt} guide={guide} command={command} />
      )}
    </>
  );
}

export function EnrollmentCard({ vm }: { vm: HostsVm }) {
  const { receipt, enrolled, progress } = vm;
  if (!receipt || !enrolled || !progress) return null;
  const guide = PLATFORM_GUIDES[enrolled.platform];

  if (progress === "connected")
    return (
      <section className="hosts-panel hosts-panel--success" role="status">
        <Steps current={4} />
        <h3 className="hosts-panel__title">{enrolled.name} is connected</h3>
        <p className="hosts-muted">
          Next, open a project, go to its <strong>Hosting</strong> tab and
          assign an environment to this machine. AlphaCI deploys there from then
          on.
        </p>
        <div className="hosts-panel__actions">
          <button className="primary-button" type="button" onClick={vm.dismiss}>
            Done
          </button>
        </div>
      </section>
    );

  if (progress === "expired")
    return (
      <section className="hosts-panel" role="status">
        <h3 className="hosts-panel__title">The enrollment code expired</h3>
        <p className="hosts-muted">
          Codes work once and only for a short time. Create a new one and run
          the installer again.
        </p>
        <div className="hosts-panel__actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              vm.setName(enrolled.name);
              vm.setPlatform(enrolled.platform);
              vm.dismiss();
              vm.startAdding();
            }}
          >
            Get a new code
          </button>
          <button className="ghost-button" type="button" onClick={vm.dismiss}>
            Close
          </button>
        </div>
      </section>
    );

  const instructions = enrollmentInstructions(receipt);
  const command = instructions[enrolled.platform];
  return (
    <section className="hosts-panel" aria-label={`Install ${enrolled.name}`}>
      <Steps current={2} />
      <header className="hosts-install__head">
        <h3 className="hosts-panel__title">
          Install AlphaCI on {enrolled.name}
        </h3>
        <span className="hosts-expiry">
          Code expires in{" "}
          <strong>{countdownLabel(receipt.expiresAt, vm.now)}</strong>
        </span>
      </header>

      <div className="hosts-requirements">
        <span className="hosts-requirements__label">Before you start</span>
        <ul className="hosts-checklist">
          {guide.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <InstallOptions
        vm={vm}
        receipt={receipt}
        guide={guide}
        command={command}
      />

      <div className="hosts-waiting" role="status">
        <span className="hosts-spinner" aria-hidden="true" />
        Waiting for {enrolled.name} to connect… this page updates by itself.
      </div>

      <details className="hosts-details">
        <summary>Troubleshooting and manual verification</summary>
        <ul>
          <li>
            The code works once and isn&apos;t shown again after you leave this
            page.
          </li>
          {guide.missingPrerequisite ? (
            <li>{guide.missingPrerequisite}</li>
          ) : null}
          <li>
            {vm.canDownloadInstallFile
              ? "The install file and the command check"
              : "The command checks"}{" "}
            the download against SHA-256{" "}
            <code>{receipt.installer.sha256}</code> before running anything.
            Installer {receipt.installer.version}:{" "}
            <a href={receipt.installer.url}>download the archive</a>.
          </li>
          {enrolled.platform === "windows" ? (
            <li>
              The host opens the port of each environment assigned to it to your
              local network, and closes it when the environment is unassigned. A
              restart may be needed the first time WSL is set up.
            </li>
          ) : null}
          <li>
            If the installer reports a missing prerequisite, fix it and run the
            same{" "}
            {vm.canDownloadInstallFile ? "file again, or the same command" : "command"}{" "}
            with this code.
          </li>
        </ul>
      </details>

      <div className="hosts-panel__actions">
        <button className="ghost-button" type="button" onClick={vm.dismiss}>
          Hide instructions
        </button>
      </div>
    </section>
  );
}

export function HostCard({
  host,
  vm,
  canManage,
}: {
  host: MachineSummary;
  vm: HostsVm;
  canManage: boolean;
}) {
  const label = hostConnectionLabel(host, vm.now);
  const failed = host.checks.filter((check) => check.status === "failed");
  return (
    <article className="hosts-card">
      <header className="hosts-card__head">
        <div>
          <h3 className="hosts-card__name">{host.name}</h3>
          <p className="hosts-card__meta">
            {PLATFORM_GUIDES[host.platform].label}
            {host.agentVersion ? ` · Agent ${host.agentVersion}` : ""} ·{" "}
            {lastSeenLabel(host.lastSeenAt, vm.now)}
          </p>
        </div>
        <span className={`status-chip status-chip-${hostStatusTone(label)}`}>
          {label}
        </span>
      </header>
      <HostGuidance host={host} label={label} failed={failed} />
      {canManage ? <HostActions host={host} vm={vm} /> : null}
    </article>
  );
}

function HostGuidance({
  host,
  label,
  failed,
}: {
  host: MachineSummary;
  label: string;
  failed: MachineSummary["checks"];
}) {
  if (host.status === "enrollment_pending")
    return (
      <p className="hosts-muted">
        Waiting for the installer to run on this machine. Lost the code? Add the
        host again; unused codes expire on their own.
      </p>
    );
  if (host.status === "revoked")
    return (
      <p className="hosts-muted">
        This machine can no longer receive deployments.
      </p>
    );
  if (failed.length)
    return (
      <div className="hosts-alert" role="alert">
        <p className="hosts-task__title">Fix on the machine:</p>
        <ul>
          {failed.map((check) => (
            <li key={check.id}>{check.message}</li>
          ))}
        </ul>
      </div>
    );
  if (label === "Offline")
    return (
      <p className="hosts-muted">
        No check-in for a while. Make sure the machine is on and connected to
        the internet; the agent reconnects by itself.
      </p>
    );
  return (
    <p className="hosts-muted">
      {host.checks.length
        ? `All ${host.checks.length} readiness checks passed. `
        : ""}
      Assign environments to it from a project’s Hosting tab.
    </p>
  );
}

function HostActions({ host, vm }: { host: MachineSummary; vm: HostsVm }) {
  if (host.status === "enrollment_pending" || host.status === "revoked")
    return null;
  const confirming = vm.confirmation?.endsWith(host.id);
  return (
    <div className="hosts-card__actions">
      {confirming ? (
        <p className="hosts-muted">
          {vm.confirmation?.startsWith("revoke")
            ? "The machine stops receiving deployments. Running apps and data stay on it."
            : "You’ll get a new code to run on the machine; the old credential stops working. Environment assignments stay as they are."}
        </p>
      ) : null}
      <div className="hosts-card__buttons">
        <button
          className="ghost-button"
          disabled={vm.busy}
          onClick={() => void vm.enroll(host)}
        >
          {vm.confirmation === `replace:${host.id}`
            ? "Confirm new credential"
            : "Replace credential"}
        </button>
        <button
          className="ghost-button hosts-danger"
          disabled={vm.busy}
          onClick={() => void vm.revoke(host)}
        >
          {vm.confirmation === `revoke:${host.id}`
            ? "Confirm revoke"
            : "Revoke access"}
        </button>
        {confirming ? (
          <button className="ghost-button" onClick={vm.cancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
