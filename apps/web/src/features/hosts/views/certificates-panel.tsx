'use client';
import {
  certificateExpiryLabel,
  certificateExpiryTone,
  type Certificate,
  type CertificateDraft,
} from '../model/address-binding';
import { useCertificatesViewModel } from '../view-models/use-certificates-view-model';

type CertificatesVm = ReturnType<typeof useCertificatesViewModel>;

/** The workspace's TLS certificates, for environments served on their own address. */
export function CertificatesPanel({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) {
  const vm = useCertificatesViewModel(workspaceId, canManage);
  return (
    <section
      className="glass-panel team-detail-surface hosts"
      aria-label="Workspace certificates"
    >
      <header className="hosts__head">
        <div>
          <h2 className="hosts__title">Certificates</h2>
          <p className="hosts-muted">
            For environments served on your own address. Upload a .pfx exported
            from IIS, or a PEM certificate and key. The key stays on the server.
          </p>
        </div>
        {canManage && !vm.draft ? (
          <button
            className="primary-button"
            type="button"
            onClick={vm.startUpload}
          >
            Upload certificate
          </button>
        ) : null}
      </header>
      {vm.error ? (
        <p role="alert" className="hosts-alert">
          {vm.error}
        </p>
      ) : null}
      {vm.draft ? <UploadForm vm={vm} draft={vm.draft} /> : null}
      <CertificateList vm={vm} canManage={canManage} />
    </section>
  );
}

function CertificateList({
  vm,
  canManage,
}: {
  vm: CertificatesVm;
  canManage: boolean;
}) {
  if (vm.status === 'loading')
    return (
      <p role="status" className="hosts-muted">
        Loading certificates…
      </p>
    );
  if (!vm.certificates.length)
    return vm.status === 'ready' ? (
      <p className="hosts-muted">No certificates uploaded.</p>
    ) : null;
  return (
    <div className="hosts-list">
      {vm.certificates.map((certificate) => (
        <CertificateCard
          key={certificate.id}
          certificate={certificate}
          vm={vm}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function usedByLabel(count: number) {
  if (count === 0) return 'Not used';
  return count === 1
    ? 'Used by 1 environment'
    : `Used by ${count} environments`;
}

function CertificateCard({
  certificate,
  vm,
  canManage,
}: {
  certificate: Certificate;
  vm: CertificatesVm;
  canManage: boolean;
}) {
  return (
    <article className="hosts-card">
      <header className="hosts-card__head">
        <div>
          <h3 className="hosts-card__name">{certificate.name}</h3>
          <p className="hosts-card__meta">
            {certificate.hostnames.join(', ')} · {certificate.issuer}
          </p>
          <p className="hosts-card__meta">{usedByLabel(certificate.inUse)}</p>
        </div>
        <span
          className={`status-chip status-chip-${certificateExpiryTone(certificate, vm.now)}`}
        >
          {certificateExpiryLabel(certificate, vm.now)}
        </span>
      </header>
      {canManage ? (
        <CertificateActions certificate={certificate} vm={vm} />
      ) : null}
    </article>
  );
}

function CertificateActions({
  certificate,
  vm,
}: {
  certificate: Certificate;
  vm: CertificatesVm;
}) {
  if (certificate.inUse > 0)
    return (
      <div className="hosts-card__actions">
        <p className="hosts-muted">
          To delete it, first give the environments that use it another
          certificate.
        </p>
      </div>
    );
  const confirming = vm.confirmation === certificate.id;
  return (
    <div className="hosts-card__actions">
      {confirming ? (
        <p className="hosts-muted">The certificate and its key are deleted.</p>
      ) : null}
      <div className="hosts-card__buttons">
        <button
          className="ghost-button hosts-danger"
          type="button"
          disabled={vm.busy}
          onClick={() => void vm.remove(certificate)}
        >
          {confirming ? 'Confirm delete' : 'Delete'}
        </button>
        {confirming ? (
          <button className="ghost-button" type="button" onClick={vm.cancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UploadForm({
  vm,
  draft,
}: {
  vm: CertificatesVm;
  draft: CertificateDraft;
}) {
  return (
    <form
      className="hosts-panel"
      aria-label="Upload a certificate"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.upload();
      }}
    >
      <label className="hosts-field">
        <span className="hosts-field__label">Name</span>
        <input
          required
          maxLength={80}
          value={draft.name}
          placeholder="e.g. orders.example.com 2027"
          onChange={(event) => vm.setName(event.target.value)}
        />
      </label>
      <fieldset className="hosts-field">
        <legend className="hosts-field__label">Format</legend>
        <div className="hosts-certs__formats">
          <FormatChoice
            vm={vm}
            draft={draft}
            format="pfx"
            label=".pfx or .p12 (IIS export)"
          />
          <FormatChoice
            vm={vm}
            draft={draft}
            format="pem"
            label="PEM certificate and key"
          />
        </div>
      </fieldset>
      {draft.format === 'pfx' ? (
        <PfxFields vm={vm} draft={draft} />
      ) : (
        <PemFields vm={vm} draft={draft} />
      )}
      {vm.draftProblem ? (
        <p className="hosts-field__hint">{vm.draftProblem}</p>
      ) : null}
      <div className="hosts-panel__actions">
        <button
          className="primary-button"
          type="submit"
          disabled={vm.busy || Boolean(vm.draftProblem)}
        >
          {vm.busy ? 'Uploading…' : 'Upload'}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={vm.cancelUpload}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function FormatChoice({
  vm,
  draft,
  format,
  label,
}: {
  vm: CertificatesVm;
  draft: CertificateDraft;
  format: CertificateDraft['format'];
  label: string;
}) {
  return (
    <label className="hosts-certs__format">
      <input
        type="radio"
        name="certificate-format"
        value={format}
        checked={draft.format === format}
        onChange={() => vm.setFormat(format)}
      />{' '}
      {label}
    </label>
  );
}

function PfxFields({
  vm,
  draft,
}: {
  vm: CertificatesVm;
  draft: Extract<CertificateDraft, { format: 'pfx' }>;
}) {
  return (
    <>
      <label className="hosts-field">
        <span className="hosts-field__label">Certificate file</span>
        <input
          type="file"
          accept=".pfx,.p12,application/x-pkcs12"
          onChange={(event) =>
            void vm.choosePfx(event.target.files?.[0] ?? null)
          }
        />
        {draft.fileName ? (
          <span className="hosts-field__hint">{draft.fileName}</span>
        ) : null}
      </label>
      <label className="hosts-field">
        <span className="hosts-field__label">Password</span>
        <span className="hosts-field__hint">
          The password you set when exporting it. Leave empty if it has none.
        </span>
        <input
          type="password"
          autoComplete="off"
          className="hosts-certs__input"
          value={draft.password}
          onChange={(event) => vm.setPassword(event.target.value)}
        />
      </label>
    </>
  );
}

function PemFields({
  vm,
  draft,
}: {
  vm: CertificatesVm;
  draft: Extract<CertificateDraft, { format: 'pem' }>;
}) {
  return (
    <>
      <PemField
        vm={vm}
        field="certificatePem"
        label="Certificate"
        hint="Include the intermediate certificates after it."
        value={draft.certificatePem}
        placeholder="-----BEGIN CERTIFICATE-----"
        accept=".pem,.crt,.cer"
      />
      <PemField
        vm={vm}
        field="privateKeyPem"
        label="Private key"
        value={draft.privateKeyPem}
        placeholder="-----BEGIN PRIVATE KEY-----"
        accept=".pem,.key"
      />
    </>
  );
}

function PemField({
  vm,
  field,
  label,
  hint,
  value,
  placeholder,
  accept,
}: {
  vm: CertificatesVm;
  field: 'certificatePem' | 'privateKeyPem';
  label: string;
  hint?: string;
  value: string;
  placeholder: string;
  accept: string;
}) {
  return (
    <div className="hosts-field">
      <label className="hosts-field__label" htmlFor={`certificate-${field}`}>
        {label}
      </label>
      {hint ? <span className="hosts-field__hint">{hint}</span> : null}
      <textarea
        id={`certificate-${field}`}
        className="hosts-certs__pem"
        rows={5}
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => vm.setPem(field, event.target.value)}
      />
      <input
        type="file"
        accept={accept}
        aria-label={`${label} file`}
        onChange={(event) =>
          void vm.choosePemFile(field, event.target.files?.[0] ?? null)
        }
      />
    </div>
  );
}
