import { isIP } from 'node:net';
import type {
  AddressBinding,
  BindingReport,
  BindingStatus,
  BindingTls,
} from '#kernel/ports/onprem-assignment.port';
import { agentAtLeast } from './onprem-tunnel';

/**
 * Bound addresses: the customer's own name, optional listen IP and
 * certificate for an environment, served by a proxy on the machine. This is
 * the IIS binding (IP, port 443, host name, certificate) in AlphaCI terms.
 */

/** The agent release that serves bound addresses; older agents ignore them. */
export const BINDING_AGENT_VERSION = '0.5.0';
export const UPDATE_AGENT_FOR_BINDING =
  'Update the agent on this machine to serve your own address.';
/** Certificates expiring within this many days are flagged by readiness. */
export const CERTIFICATE_WARNING_DAYS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const STATUSES: readonly BindingStatus[] = [
  'starting',
  'running',
  'unavailable',
  'failed',
];
const MAX_MESSAGE = 300;

export const WAITING_FOR_BINDING =
  'Waiting for the machine to report that it serves this address.';
export const UNKNOWN_BINDING_STATE =
  'The machine reported a binding state that AlphaCI does not recognize.';

/** A DNS name AlphaCI accepts as a bound hostname: two or more labels, no wildcard. */
export function isBindingHostname(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 253) return false;
  const labels = value.split('.');
  return (
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label)) &&
    // The last label is never all digits, so an IPv4 literal is not a name.
    !/^[0-9]+$/.test(labels.at(-1)!)
  );
}

/** An IPv4 or IPv6 literal, without brackets or zone. */
export function isListenAddress(value: unknown): value is string {
  return typeof value === 'string' && !value.includes('%') && isIP(value) !== 0;
}

/**
 * The binding a client sent, checked and normalized (lowercase hostname,
 * canonical empty listen address). Returns the reason when it is unacceptable.
 */
export function normalizeBinding(
  input: unknown,
  production: boolean,
): { binding: AddressBinding } | { error: string } {
  if (!input || typeof input !== 'object')
    return { error: 'Describe the address: hostname and certificate.' };
  const value = input as Record<string, unknown>;
  const hostname =
    typeof value['hostname'] === 'string'
      ? value['hostname'].trim().toLowerCase().replace(/\.$/, '')
      : '';
  if (!isBindingHostname(hostname))
    return {
      error:
        'Enter the hostname as a DNS name such as orders.example.com, without https:// or a port.',
    };
  const rawListen = value['listenAddress'] ?? null;
  const trimmed = typeof rawListen === 'string' ? rawListen.trim() : rawListen;
  const listen = trimmed === '' ? null : trimmed;
  if (listen !== null && !isListenAddress(listen))
    return {
      error:
        'The listen address must be an IPv4 or IPv6 address on the machine, or empty to listen on every address.',
    };
  const tls = value['tls'] as Record<string, unknown> | undefined;
  let normalizedTls: BindingTls;
  switch (tls?.['kind']) {
    case 'acme':
      normalizedTls = { kind: 'acme' };
      break;
    case 'internal':
      if (production)
        return {
          error:
            'Production needs a trusted certificate: upload one or use an automatic certificate.',
        };
      normalizedTls = { kind: 'internal' };
      break;
    case 'certificate': {
      const id = tls['certificateId'];
      if (typeof id !== 'string' || !UUID.test(id))
        return { error: 'Choose an uploaded certificate.' };
      normalizedTls = { kind: 'certificate', certificateId: id.toLowerCase() };
      break;
    }
    default:
      return {
        error:
          'Choose the certificate: an uploaded one, an automatic one, or the internal test certificate.',
      };
  }
  return {
    binding: {
      hostname,
      listenAddress: listen,
      tls: normalizedTls,
    },
  };
}

/** The address users open for a binding: always HTTPS on 443. */
export function bindingAddress(binding: AddressBinding): string {
  return `https://${binding.hostname}`;
}

/**
 * Whether a certificate's DNS names cover a hostname. A wildcard covers
 * exactly one label (`*.example.com` covers `a.example.com`, not
 * `a.b.example.com` or `example.com`), as browsers check it.
 */
export function certificateCovers(
  names: readonly string[],
  hostname: string,
): boolean {
  const host = hostname.toLowerCase();
  return names.some((raw) => {
    const name = raw.toLowerCase().replace(/\.$/, '');
    if (name === host) return true;
    if (!name.startsWith('*.')) return false;
    const suffix = name.slice(1);
    const head = host.slice(0, host.length - suffix.length);
    return host.endsWith(suffix) && head.length > 0 && !head.includes('.');
  });
}

/** A binding report as the machine sends it, validated. */
export interface BindingReportInput {
  assignmentId: string;
  status: BindingStatus;
  message: string;
}

/** The part of a binding's report columns that the API presents. */
export interface BindingReportRow {
  status: BindingStatus | null;
  message: string | null;
  reportedAt: Date | null;
  fresh: boolean;
}

/** One binding entry from a heartbeat; null when it names no valid assignment. */
export function parseBindingReport(entry: unknown): BindingReportInput | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Record<string, unknown>;
  const assignmentId = value['assignmentId'];
  if (typeof assignmentId !== 'string' || !UUID.test(assignmentId)) return null;
  const message =
    typeof value['message'] === 'string'
      ? value['message']
          .split(String.fromCharCode(0))
          .join('')
          .slice(0, MAX_MESSAGE)
      : '';
  const status = value['status'];
  if (typeof status !== 'string' || !STATUSES.includes(status as BindingStatus))
    return { assignmentId, status: 'failed', message: UNKNOWN_BINDING_STATE };
  return { assignmentId, status: status as BindingStatus, message };
}

/** The API view of an assignment's latest binding report. */
export function bindingReport(row: BindingReportRow): BindingReport {
  const reportedAt = row.reportedAt?.toISOString() ?? null;
  if (!row.status || !row.fresh)
    return { status: 'waiting', message: WAITING_FOR_BINDING, reportedAt };
  return {
    status: row.status,
    message: row.message || WAITING_FOR_BINDING,
    reportedAt,
  };
}

/** The certificate facts readiness needs; null for ACME and internal. */
export interface BoundCertificate {
  name: string;
  notAfter: Date;
  deleted: boolean;
}

/**
 * Readiness of a bound address. The address is known up front, so deploying
 * never waits for it; readiness says whether the machine serves it and
 * whether its certificate is about to expire.
 */
export function bindingReadiness(
  binding: AddressBinding,
  report: BindingReport,
  agentVersion: string | null,
  certificate: BoundCertificate | null,
  now: Date = new Date(),
): { status: 'passed' | 'failed' | 'unverified'; message: string } {
  if (!agentAtLeast(agentVersion, BINDING_AGENT_VERSION))
    return { status: 'failed', message: UPDATE_AGENT_FOR_BINDING };
  if (binding.tls.kind === 'certificate') {
    if (!certificate || certificate.deleted)
      return {
        status: 'failed',
        message:
          'The certificate this address uses was deleted. Choose another one.',
      };
    if (certificate.notAfter <= now)
      return {
        status: 'failed',
        message: `Certificate ${certificate.name} expired on ${day(certificate.notAfter)}. Upload a renewed one and select it.`,
      };
  }
  if (report.status !== 'running')
    return {
      status: 'failed',
      message: report.message,
    };
  const dns = binding.listenAddress
    ? `Point DNS for ${binding.hostname} at ${binding.listenAddress}`
    : `Point DNS for ${binding.hostname} at this machine`;
  const expiring =
    certificate &&
    certificate.notAfter.getTime() - now.getTime() <
      CERTIFICATE_WARNING_DAYS * 86_400_000
      ? ` Certificate ${certificate.name} expires on ${day(certificate.notAfter)}; upload a renewed one.`
      : '';
  return {
    status: 'unverified',
    message: `The machine serves ${bindingAddress(binding)}. ${dns}, then open it from a client device.${expiring}`,
  };
}

const day = (date: Date) => date.toISOString().slice(0, 10);
