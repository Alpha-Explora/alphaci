import type {
  BindingReport,
  OnpremAddressBinding,
  OnpremAssignmentIngress,
  OnpremBindingTls,
  OnpremCertificate,
  OnpremCertificateUpload,
} from '@/shared/api/contracts';

export type AddressBinding = OnpremAddressBinding;
export type BindingTls = OnpremBindingTls;
export type Certificate = OnpremCertificate;
export type CertificateUpload = OnpremCertificateUpload;
export type AssignmentIngress = OnpremAssignmentIngress;
export type IngressMode = AssignmentIngress['mode'];
export type { BindingReport };

const DAY = 86_400_000;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Why a hostname cannot be bound, or null. Mirrors the server's rule. */
export function hostnameProblem(hostname: string): string | null {
  if (!hostname) return 'Enter the hostname users will open.';
  if (/[:/]/.test(hostname))
    return 'Enter only the hostname, without https:// or a port.';
  if (hostname.includes('*')) return 'Wildcard hostnames cannot be bound.';
  if (hostname !== hostname.toLowerCase()) return 'Use lowercase letters.';
  const labels = hostname.split('.');
  if (
    hostname.length > 253 ||
    labels.length < 2 ||
    !labels.every((label) => LABEL.test(label))
  )
    return 'Enter a DNS name such as orders.example.com.';
  return null;
}

function isIpv6(value: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(':')) return false;
  try {
    // The URL parser accepts exactly the IPv6 literals a browser would.
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

/** True for an IPv4 or IPv6 literal. */
export function isIpAddress(value: string): boolean {
  return IPV4.test(value) || isIpv6(value);
}

/** Why a listen address cannot be used, or null. Empty means every address. */
export function listenAddressProblem(value: string | null): string | null {
  if (!value) return null;
  return isIpAddress(value)
    ? null
    : 'Enter an IPv4 or IPv6 address of this machine, or leave it empty.';
}

/** True when one of the certificate's names covers the hostname. */
export function certificateCovers(
  certificate: Pick<Certificate, 'hostnames'>,
  hostname: string,
): boolean {
  return certificate.hostnames.some((name) => {
    const pattern = name.toLowerCase();
    if (!pattern.startsWith('*.')) return pattern === hostname;
    // A wildcard covers exactly one label: *.acme.local covers a.acme.local.
    const dot = hostname.indexOf('.');
    return dot > 0 && hostname.slice(dot + 1) === pattern.slice(2);
  });
}

export type CertificateExpiry =
  | { state: 'valid'; days: number }
  | { state: 'expiring'; days: number }
  | { state: 'expired' };

/** Expired, within 30 days of expiry, or valid. */
export function certificateExpiry(
  certificate: Pick<Certificate, 'notAfter'>,
  now = Date.now(),
): CertificateExpiry {
  const left = Date.parse(certificate.notAfter) - now;
  if (left <= 0) return { state: 'expired' };
  const days = Math.floor(left / DAY);
  return days < 30 ? { state: 'expiring', days } : { state: 'valid', days };
}

/** "Expired 2026-01-02", "Expires in 12 days" or "Expires 2027-01-02". */
export function certificateExpiryLabel(
  certificate: Pick<Certificate, 'notAfter'>,
  now = Date.now(),
): string {
  const date = certificate.notAfter.slice(0, 10);
  const expiry = certificateExpiry(certificate, now);
  if (expiry.state === 'expired') return `Expired ${date}`;
  if (expiry.state === 'expiring')
    return expiry.days === 1
      ? 'Expires in 1 day'
      : `Expires in ${expiry.days} days`;
  return `Expires ${date}`;
}

export function certificateExpiryTone(
  certificate: Pick<Certificate, 'notAfter'>,
  now = Date.now(),
): 'success' | 'amber' | 'danger' {
  const { state } = certificateExpiry(certificate, now);
  if (state === 'expired') return 'danger';
  return state === 'expiring' ? 'amber' : 'success';
}

function certificateProblem(
  certificateId: string,
  hostname: string,
  certificates: readonly Certificate[],
  now: number,
): string | null {
  if (!certificateId) return 'Choose a certificate.';
  const certificate = certificates.find((item) => item.id === certificateId);
  if (!certificate) return 'That certificate no longer exists. Choose another.';
  if (certificateExpiry(certificate, now).state === 'expired')
    return `${certificate.name} has expired. Upload a new one on the Hosts page.`;
  if (hostname && !certificateCovers(certificate, hostname))
    return `${certificate.name} does not cover ${hostname}.`;
  return null;
}

/** The first reason the server would refuse this binding, or null. */
export function bindingProblem(
  binding: AddressBinding,
  context: {
    production: boolean;
    certificates: readonly Certificate[];
    now?: number;
  },
): string | null {
  const problem =
    hostnameProblem(binding.hostname) ??
    listenAddressProblem(binding.listenAddress);
  if (problem) return problem;
  if (binding.tls.kind === 'internal' && context.production)
    return 'Production needs an uploaded or automatic certificate.';
  if (binding.tls.kind !== 'certificate') return null;
  return certificateProblem(
    binding.tls.certificateId,
    binding.hostname,
    context.certificates,
    context.now ?? Date.now(),
  );
}

/** The value of the certificate picker for a TLS choice. */
export function tlsChoice(tls: BindingTls): string {
  return tls.kind === 'certificate'
    ? `certificate:${tls.certificateId}`
    : tls.kind;
}

/** The TLS choice a picker value stands for. */
export function tlsFromChoice(value: string): BindingTls {
  if (value === 'acme' || value === 'internal') return { kind: value };
  return {
    kind: 'certificate',
    certificateId: value.replace(/^certificate:/, ''),
  };
}

/** The DNS record users need so the hostname reaches the machine. */
export function dnsRecord(
  binding: Pick<AddressBinding, 'hostname' | 'listenAddress'>,
) {
  const target = binding.listenAddress;
  return {
    type: target && target.includes(':') ? 'AAAA' : 'A',
    name: binding.hostname || 'your hostname',
    value: target || "this machine's IP address",
  } as const;
}

/**
 * The ingress after the user picks another mode. Modes whose address the
 * server or machine provides (tunnel, bound) send no publicUrl. A binding
 * typed earlier is kept while the user flips between modes in one edit.
 */
export function withIngressMode(
  ingress: AssignmentIngress,
  mode: IngressMode,
  remembered?: AddressBinding,
): AssignmentIngress {
  if (mode === 'bound')
    return {
      mode,
      publicUrl: null,
      binding:
        ingress.mode === 'bound'
          ? ingress.binding
          : (remembered ?? emptyBinding()),
    };
  const publicUrl =
    mode === 'configured' && ingress.mode !== 'bound'
      ? ingress.publicUrl
      : null;
  return { mode, publicUrl };
}

/** A blank binding. It starts on ACME, which production also accepts. */
export function emptyBinding(): AddressBinding {
  return { hostname: '', listenAddress: null, tls: { kind: 'acme' } };
}

/**
 * The binding with one field edited. Hostnames are case-insensitive, so one
 * typed in capitals is stored lowercase; an empty listen address is null.
 */
export function withBindingField(
  binding: AddressBinding,
  field: 'hostname' | 'listenAddress',
  value: string,
): AddressBinding {
  const trimmed = value.trim();
  if (field === 'hostname')
    return { ...binding, hostname: trimmed.toLowerCase() };
  return { ...binding, listenAddress: trimmed || null };
}

export interface BindingStatusView {
  label: string;
  tone: 'success' | 'danger' | 'amber' | 'muted' | 'brand';
  message: string;
}

const BINDING_STATUS: Record<
  BindingReport['status'],
  Omit<BindingStatusView, 'message'> & { fallback: string }
> = {
  waiting: {
    label: 'Waiting',
    tone: 'muted',
    fallback: 'Waiting for the machine to report the address.',
  },
  starting: {
    label: 'Starting',
    tone: 'brand',
    fallback: 'The machine is setting up the address.',
  },
  running: {
    label: 'Serving',
    tone: 'success',
    fallback: 'The machine serves this address.',
  },
  unavailable: {
    label: 'Unavailable',
    tone: 'amber',
    fallback: 'The machine cannot serve this address yet.',
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    fallback: 'The machine could not serve this address.',
  },
};

/** How the summary shows the machine's binding report. */
export function bindingStatusView(
  report: BindingReport | null,
): BindingStatusView {
  const entry = BINDING_STATUS[report?.status ?? 'waiting'];
  return {
    label: entry.label,
    tone: entry.tone,
    message: report?.message.trim() || entry.fallback,
  };
}

/** A certificate upload as typed: either a .pfx with its password, or PEM text. */
export type CertificateDraft =
  | {
      format: 'pfx';
      name: string;
      pfxBase64: string;
      fileName: string;
      password: string;
    }
  | {
      format: 'pem';
      name: string;
      certificatePem: string;
      privateKeyPem: string;
    };

export function emptyCertificateDraft(
  format: CertificateDraft['format'] = 'pfx',
): CertificateDraft {
  return format === 'pfx'
    ? { format, name: '', pfxBase64: '', fileName: '', password: '' }
    : { format, name: '', certificatePem: '', privateKeyPem: '' };
}

/** Why the draft cannot be uploaded yet, or null. The server checks the rest. */
export function certificateDraftProblem(
  draft: CertificateDraft,
): string | null {
  if (!draft.name.trim()) return 'Name the certificate.';
  if (draft.format === 'pfx')
    return draft.pfxBase64 ? null : 'Choose a .pfx or .p12 file.';
  if (!/-----BEGIN [A-Z0-9 ]*CERTIFICATE-----/.test(draft.certificatePem))
    return 'Paste the certificate in PEM format (-----BEGIN CERTIFICATE-----).';
  if (!/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(draft.privateKeyPem))
    return 'Paste the private key in PEM format (-----BEGIN PRIVATE KEY-----).';
  return null;
}

/** The request body for a draft. */
export function certificateUpload(draft: CertificateDraft): CertificateUpload {
  const name = draft.name.trim();
  return draft.format === 'pfx'
    ? { name, pfxBase64: draft.pfxBase64, password: draft.password }
    : {
        name,
        certificatePem: draft.certificatePem.trim(),
        privateKeyPem: draft.privateKeyPem.trim(),
      };
}

/** Base64 of raw file bytes, for a .pfx upload. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk)
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}
