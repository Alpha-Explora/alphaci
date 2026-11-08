'use client';
import {
  hostConnectionLabel,
  hostStatusTone,
  reachedAt,
} from '../model/host-types';
import {
  bindingStatusView,
  certificateExpiryLabel,
  dnsRecord,
  tlsChoice,
  type AddressBinding,
  type BindingReport,
  type IngressMode,
} from '../model/address-binding';
import type { useHostAssignmentViewModel } from '../view-models/use-host-assignment-view-model';
export type AssignmentVm = ReturnType<typeof useHostAssignmentViewModel>;
export function AssignmentForm({ vm }: { vm: AssignmentVm }) {
  return (
    <form
      className="hassign-form"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.assign();
      }}
    >
      <MachineField vm={vm} />
      {vm.config.ports.map((port) => (
        <PortFields key={port.slot} port={port} vm={vm} />
      ))}
      <IngressFields vm={vm} />
      <p className="hassign-hint">
        AlphaCI picks a free host port on the machine for each service. The
        health path must return a success response. Production needs an HTTPS
        address: your own URL, the automatic tunnel, or your own address with a
        certificate.
      </p>
      <AssignmentActions vm={vm} />
    </form>
  );
}
/** A choice only when several machines are connected. */
function MachineField({ vm }: { vm: AssignmentVm }) {
  if (vm.choices.length > 1)
    return (
      <label className="hassign-field">
        <span className="hassign-field__label">Machine</span>
        <select
          value={vm.selected}
          onChange={(event) => vm.setSelected(event.target.value)}
          required
        >
          <option value="">Choose a connected machine</option>
          {vm.choices.map((host) => (
            <option value={host.id} key={host.id}>
              {host.name} · {hostConnectionLabel(host)}
            </option>
          ))}
        </select>
      </label>
    );
  const machine =
    vm.hosts.find((host) => host.id === vm.selected) ?? vm.automatic;
  return (
    <div className="hassign-field">
      <span className="hassign-field__label">Machine</span>
      {machine ? (
        <p className="hassign-summary__name">{machine.name}</p>
      ) : (
        <p role="status" className="hassign-hint">
          No machine is connected. Enroll a host, or start its agent, then
          assign.
        </p>
      )}
    </div>
  );
}
function PortFields({
  port,
  vm,
}: {
  port: AssignmentVm['config']['ports'][number];
  vm: AssignmentVm;
}) {
  return (
    <fieldset className="hassign-ports">
      <legend className="hassign-field__label">{port.slot}</legend>
      <div className="hassign-ports__grid">
        <label className="hassign-field">
          <span className="hassign-field__hint">Container port</span>
          <input
            type="number"
            required
            min={1}
            max={65535}
            value={port.containerPort}
            onChange={(event) => vm.port(port.slot, event.target.value)}
          />
        </label>
        <label className="hassign-field">
          <span className="hassign-field__hint">Health path</span>
          <input
            value={
              vm.config.health.find((item) => item.slot === port.slot)?.path ??
              ''
            }
            placeholder="/health"
            onChange={(event) => vm.health(port.slot, event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
const INGRESS_MODES: Array<{ value: IngressMode; label: string }> = [
  { value: 'direct', label: 'Directly on the host port' },
  { value: 'configured', label: 'Through an existing proxy or domain' },
  { value: 'tunnel', label: 'Automatic HTTPS address' },
  { value: 'bound', label: 'Your own address' },
];
function IngressFields({ vm }: { vm: AssignmentVm }) {
  const { ingress } = vm.config;
  return (
    <div className="hassign-ingress">
      <label className="hassign-field">
        <span className="hassign-field__label">How users reach it</span>
        <select
          value={ingress.mode}
          onChange={(event) =>
            vm.setIngressMode(event.target.value as IngressMode)
          }
        >
          {INGRESS_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>
      {ingress.mode === 'tunnel' ? (
        <p className="hassign-hint">
          AlphaCI gives this environment an HTTPS address. On a server with an
          apps domain it is permanent (for example
          https://myapp.apps.example.com); otherwise it is a tunnel address that
          changes when the tunnel restarts.
        </p>
      ) : null}
      {ingress.mode === 'configured' ? <PublicUrlField vm={vm} /> : null}
      {ingress.mode === 'bound' ? (
        <BindingFields vm={vm} binding={ingress.binding} />
      ) : null}
    </div>
  );
}
function PublicUrlField({ vm }: { vm: AssignmentVm }) {
  return (
    <label className="hassign-field">
      <span className="hassign-field__label">Public application URL</span>
      <input
        type="url"
        required
        value={vm.config.ingress.publicUrl ?? ''}
        placeholder="https://app.example.com"
        onChange={(event) =>
          vm.setConfig((old) => ({
            ...old,
            ingress: {
              mode: 'configured',
              publicUrl: event.target.value || null,
            },
          }))
        }
      />
    </label>
  );
}
/** An IIS-style binding: hostname, optional local IP, and a certificate. */
function BindingFields({
  vm,
  binding,
}: {
  vm: AssignmentVm;
  binding: AddressBinding;
}) {
  return (
    <>
      <label className="hassign-field">
        <span className="hassign-field__label">Hostname</span>
        <input
          required
          value={binding.hostname}
          placeholder="orders.example.com"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) =>
            vm.setBindingField('hostname', event.target.value)
          }
        />
      </label>
      <label className="hassign-field">
        <span className="hassign-field__label">Listen address (optional)</span>
        <span className="hassign-field__hint">
          The IP on this machine to listen on, as in IIS bindings. Leave empty
          for all.
        </span>
        <input
          value={binding.listenAddress ?? ''}
          placeholder="All addresses"
          spellCheck={false}
          onChange={(event) =>
            vm.setBindingField('listenAddress', event.target.value)
          }
        />
      </label>
      <CertificateField vm={vm} binding={binding} />
      <DnsRecord binding={binding} />
      {vm.ingressProblem ? (
        <p role="alert" className="hassign-alert">
          {vm.ingressProblem}
        </p>
      ) : null}
    </>
  );
}
function CertificateField({
  vm,
  binding,
}: {
  vm: AssignmentVm;
  binding: AddressBinding;
}) {
  return (
    <label className="hassign-field">
      <span className="hassign-field__label">Certificate</span>
      <select
        value={tlsChoice(binding.tls)}
        onChange={(event) => vm.setBindingTls(event.target.value)}
      >
        {binding.tls.kind === 'certificate' && !binding.tls.certificateId ? (
          <option value="certificate:">Choose a certificate</option>
        ) : null}
        {vm.certificates.length ? (
          <optgroup label="Uploaded">
            {vm.certificates.map((certificate) => (
              <option
                key={certificate.id}
                value={`certificate:${certificate.id}`}
              >
                {certificate.name} · {certificateExpiryLabel(certificate)}
              </option>
            ))}
          </optgroup>
        ) : null}
        <option value="acme">
          Automatic (public DNS and ports 80 and 443 must reach this machine)
        </option>
        {vm.production ? null : (
          <option value="internal">Internal (test only)</option>
        )}
      </select>
      {vm.certificates.length ? null : (
        <span className="hassign-field__hint">
          To use your own certificate (.pfx or PEM), upload it on the Hosts
          page.
        </span>
      )}
    </label>
  );
}
function DnsRecord({ binding }: { binding: AddressBinding }) {
  const record = dnsRecord(binding);
  return (
    <div className="hassign-dns">
      <p className="hassign-field__label">DNS record to create</p>
      <p className="hassign-dns__record">
        <code>{record.type}</code> <code>{record.name}</code> →{' '}
        <code>{record.value}</code>
      </p>
      <p className="hassign-hint">
        Users reach https://{binding.hostname || 'your hostname'} once this
        record points at the machine.
      </p>
    </div>
  );
}
function AssignmentActions({ vm }: { vm: AssignmentVm }) {
  return (
    <>
      {vm.confirmation ? (
        <p className="hassign-hint">
          Confirm this change. It applies to the next deployment. Containers and
          data already on the machine stay until you stop or remove them.
        </p>
      ) : null}
      <div className="hassign-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={vm.busy || !vm.canAssign}
        >
          {assignLabel(vm)}
        </button>
        {vm.current ? (
          <button
            className="ghost-button"
            type="button"
            disabled={vm.busy}
            onClick={() => void vm.unassign()}
          >
            {vm.confirmation === 'unassign' ? 'Confirm unassign' : 'Unassign'}
          </button>
        ) : null}
        {vm.confirmation ? (
          <button className="ghost-button" type="button" onClick={vm.cancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </>
  );
}
function assignLabel(vm: AssignmentVm) {
  if (vm.confirmation === 'replace') return 'Confirm replacement';
  return vm.current ? 'Save changes' : 'Assign machine';
}
export function AssignmentSummary({ vm }: { vm: AssignmentVm }) {
  if (vm.status === 'loading')
    return (
      <p role="status" className="hassign-hint">
        Loading assignment…
      </p>
    );
  if (!vm.current)
    return (
      <div className="hassign-summary hassign-summary--empty">
        <p className="hassign-summary__name">No machine assigned</p>
        <p className="hassign-hint">
          Pick one of your workspace&apos;s machines below so releases have
          somewhere to run.
        </p>
      </div>
    );
  if (vm.current.machineId === null)
    return (
      <div className="hassign-summary">
        <p className="hassign-summary__name">Legacy host: {vm.current.name}</p>
        <p className="hassign-hint">
          Assign a reusable machine below to replace it.
        </p>
      </div>
    );
  const machine = vm.hosts.find((host) => host.id === vm.current?.machineId);
  const label = machine ? hostConnectionLabel(machine) : 'Unavailable';
  const { ports } = vm.current.config;
  const reach = reachedAt(vm.current.config, vm.current.tunnel);
  return (
    <div className="hassign-summary">
      <div className="hassign-summary__row">
        <p className="hassign-summary__name">
          {machine?.name ?? 'Machine unavailable'}
        </p>
        <span className={`status-chip status-chip-${hostStatusTone(label)}`}>
          {label}
        </span>
      </div>
      <dl className="hassign-facts">
        {ports.map((port) => (
          <div key={port.slot}>
            <dt>{port.slot === 'frontend' ? 'Frontend' : 'Backend'}</dt>
            <dd>
              port {port.hostPort} → {port.containerPort}
            </dd>
          </div>
        ))}
        <div>
          <dt>Reached at</dt>
          <dd>
            {reach.kind === 'link' ? (
              <a href={reach.href} target="_blank" rel="noreferrer">
                {reach.href}
              </a>
            ) : (
              reach.text
            )}
          </dd>
        </div>
        {vm.current.config.ingress.mode === 'bound' ? (
          <BindingFact report={vm.current.binding ?? null} />
        ) : null}
      </dl>
    </div>
  );
}
/** The machine's report on the bound address, failures included. */
function BindingFact({ report }: { report: BindingReport | null }) {
  const view = bindingStatusView(report);
  return (
    <div>
      <dt>Address</dt>
      <dd>
        <span className={`status-chip status-chip-${view.tone}`}>
          {view.label}
        </span>{' '}
        {view.message}
      </dd>
    </div>
  );
}
