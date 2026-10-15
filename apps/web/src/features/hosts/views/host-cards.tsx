"use client";
import type { MachineSummary } from "../model/host-types";
import { hostConnectionLabel } from "../model/host-types";
import { enrollmentInstructions } from "../model/enrollment-instructions";
import type { useHostsViewModel } from "../view-models/use-hosts-view-model";
type HostsVm = ReturnType<typeof useHostsViewModel>;
export function AddHostForm({ vm }: { vm: HostsVm }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void vm.enroll();
      }}
      style={{
        display: "flex",
        gap: "1rem",
        flexWrap: "wrap",
        alignItems: "end",
      }}
    >
      <label>
        Host name{" "}
        <input
          required
          maxLength={80}
          value={vm.name}
          onChange={(event) => vm.setName(event.target.value)}
        />
      </label>
      <label>
        Platform{" "}
        <select
          value={vm.platform}
          onChange={(event) =>
            vm.setPlatform(event.target.value as "windows" | "ubuntu")
          }
        >
          <option value="windows">Windows with Ubuntu WSL2</option>
          <option value="ubuntu">Ubuntu</option>
        </select>
      </label>
      <button
        className="primary-button"
        disabled={vm.busy || !vm.name.trim()}
        type="submit"
      >
        Add host
      </button>
    </form>
  );
}
export function EnrollmentCard({ vm }: { vm: HostsVm }) {
  const receipt = vm.receipt;
  if (!receipt) return null;
  const instructions = enrollmentInstructions(receipt);
  return (
    <div role="status" className="env-card" style={{ padding: "1rem" }}>
      <h3>
        {vm.expired
          ? "Enrollment code expired"
          : "Install and enroll your host"}
      </h3>
      <p>
        The code expires at {new Date(receipt.expiresAt).toLocaleTimeString()}.
        Paste it once into the installer prompt.
      </p>
      {!vm.expired ? (
        <code style={{ wordBreak: "break-all" }}>{receipt.code}</code>
      ) : null}
      <p>
        Download installer {receipt.installer.version}:{" "}
        <a href={receipt.installer.url}>agent archive</a>. Verify the SHA-256
        before extracting or running it.
      </p>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        SHA-256: {receipt.installer.sha256}
      </pre>
      <details>
        <summary>Ubuntu installation command</summary>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {instructions.ubuntu}
        </pre>
      </details>
      <details>
        <summary>Windows installation command</summary>
        <p>
          Run in an administrator PowerShell window as the account that owns
          Ubuntu. The example forwards ports 8080 through 8082 from the local
          network. Add the ports selected for other environments when rerunning
          the installer. Client servers should use a dedicated WSL account and
          startup task.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {instructions.windows}
        </pre>
      </details>
      <p>
        A restart or manual registry sign-in may be required. Keep this page
        open until the machine connects.
      </p>
      <button className="ghost-button" type="button" onClick={vm.dismiss}>
        Hide code
      </button>
    </div>
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
  return (
    <article className="env-card" style={{ padding: "1rem" }}>
      <h3>
        {host.name} <small>{hostConnectionLabel(host, vm.now)}</small>
      </h3>
      <p>
        {host.platform} · Agent {host.agentVersion ?? "not installed"} · Last
        seen{" "}
        {host.lastSeenAt ? new Date(host.lastSeenAt).toLocaleString() : "never"}
      </p>
      <p>
        Connection confirms an agent check-in. Deployment history reports
        application health.
      </p>
      <ul>
        {host.checks.map((check) => (
          <li key={check.id}>
            {check.id}: {check.status}. {check.message}
          </li>
        ))}
      </ul>
      {canManage ? <HostActions host={host} vm={vm} /> : null}
    </article>
  );
}
function HostActions({ host, vm }: { host: MachineSummary; vm: HostsVm }) {
  if (host.status === "enrollment_pending") return null;
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="ghost-button"
          disabled={vm.busy}
          onClick={() => void vm.enroll(host)}
        >
          {vm.confirmation === `replace:${host.id}`
            ? "Confirm credential replacement"
            : "Replace credential"}
        </button>
        {host.status !== "revoked" ? (
          <button
            className="ghost-button"
            disabled={vm.busy}
            onClick={() => void vm.revoke(host)}
          >
            {vm.confirmation === `revoke:${host.id}`
              ? "Confirm revoke"
              : "Revoke access"}
          </button>
        ) : null}
        {vm.confirmation ? (
          <button className="ghost-button" onClick={vm.cancel}>
            Cancel
          </button>
        ) : null}
      </div>
      {vm.confirmation?.endsWith(host.id) ? (
        <p>
          Existing credentials will stop accepting work. Running containers and
          data remain on the machine, including while offline. Replacement does
          not move environment assignments.
        </p>
      ) : null}
    </>
  );
}
