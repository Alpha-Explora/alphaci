import {
  X509Certificate,
  createHash,
  createPrivateKey,
  type KeyObject,
} from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import forge from 'node-forge';

/** What an upload becomes: a PEM chain (leaf first) and a PKCS#8 PEM key. */
export interface ParsedCertificate {
  certificatePem: string;
  privateKeyPem: string;
  hostnames: string[];
  issuer: string;
  notBefore: Date;
  notAfter: Date;
  /** SHA-256 (hex) of `certificatePem` as stored and delivered. */
  sha256: string;
}

export type CertificateUpload =
  | { pfxBase64: string; password: string }
  | { certificatePem: string; privateKeyPem: string };

/** IIS exports are a few kilobytes; this leaves room for long chains. */
const MAX_UPLOAD_BYTES = 64 * 1024;
const PEM_CERTIFICATE =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

const invalid = (message: string) => new BadRequestException(message);

/**
 * Read an uploaded certificate: a .pfx/.p12 file with its password, as IIS
 * exports it, or a PEM certificate chain and private key. node-forge only
 * unwraps the PKCS#12 container; every certificate and key check uses Node's
 * own X.509 support, which handles RSA and ECDSA alike.
 */
export function parseCertificateUpload(
  upload: CertificateUpload,
  now: Date = new Date(),
): ParsedCertificate {
  const { certificates, key } =
    'pfxBase64' in upload ? fromPfx(upload) : fromPem(upload);
  const leaf = certificates.find((certificate) =>
    certificate.checkPrivateKey(key),
  );
  if (!leaf)
    throw invalid(
      'The private key does not belong to any certificate in the upload.',
    );
  const chain = orderChain(leaf, certificates);
  const hostnames = dnsNames(leaf);
  if (!hostnames.length)
    throw invalid(
      'The certificate lists no DNS names (subject alternative names), so browsers would reject it. Issue one that names the hostname.',
    );
  const notBefore = new Date(leaf.validFrom);
  const notAfter = new Date(leaf.validTo);
  if (notAfter <= now)
    throw invalid(
      `The certificate expired on ${notAfter.toISOString().slice(0, 10)}.`,
    );
  const certificatePem =
    chain.map((item) => item.toString().trim()).join('\n') + '\n';
  return {
    certificatePem,
    privateKeyPem: key.export({ type: 'pkcs8', format: 'pem' }).toString(),
    hostnames,
    issuer: leaf.issuer.replace(/\n/g, ', ').slice(0, 500),
    notBefore,
    notAfter,
    sha256: createHash('sha256').update(certificatePem).digest('hex'),
  };
}

function fromPfx(upload: { pfxBase64: string; password: string }) {
  const bytes = Buffer.from(upload.pfxBase64, 'base64');
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
    throw invalid('Upload a .pfx file of at most 64 KB.');
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(bytes.toString('binary')),
      false,
      upload.password,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw invalid(
      /password|mac|decrypt/i.test(message)
        ? 'The .pfx password is wrong.'
        : 'The file is not a .pfx certificate export AlphaCI can read. Export it again with its private key, or upload PEM files.',
    );
  }
  const certificates: X509Certificate[] = [];
  for (const bag of bagsOf(p12, CERT_BAG)) {
    const asn1 = bag.cert ? forge.pki.certificateToAsn1(bag.cert) : bag.asn1;
    if (asn1) certificates.push(new X509Certificate(der(asn1)));
  }
  const keys: KeyObject[] = [];
  for (const type of [SHROUDED_KEY_BAG, KEY_BAG])
    for (const bag of bagsOf(p12, type)) {
      // RSA keys come back parsed; other key types (ECDSA) as PrivateKeyInfo.
      const info = bag.key
        ? forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(bag.key))
        : bag.asn1;
      if (info)
        keys.push(
          createPrivateKey({ key: der(info), format: 'der', type: 'pkcs8' }),
        );
    }
  if (!certificates.length)
    throw invalid('The .pfx file holds no certificate.');
  if (keys.length !== 1)
    throw invalid(
      keys.length
        ? 'The .pfx file holds several private keys. Export only the one certificate.'
        : 'The .pfx file holds no private key. Export it again with "Yes, export the private key".',
    );
  return { certificates, key: keys[0]! };
}

function fromPem(upload: { certificatePem: string; privateKeyPem: string }) {
  if (
    typeof upload.certificatePem !== 'string' ||
    typeof upload.privateKeyPem !== 'string' ||
    upload.certificatePem.length + upload.privateKeyPem.length >
      MAX_UPLOAD_BYTES
  )
    throw invalid(
      'Upload a PEM certificate and key of at most 64 KB together.',
    );
  const blocks = upload.certificatePem.match(PEM_CERTIFICATE) ?? [];
  if (!blocks.length)
    throw invalid(
      'The certificate must be PEM text starting with -----BEGIN CERTIFICATE-----.',
    );
  let certificates: X509Certificate[];
  try {
    certificates = blocks.map((block) => new X509Certificate(block));
  } catch {
    throw invalid('A certificate in the PEM text cannot be read.');
  }
  let key: KeyObject;
  try {
    key = createPrivateKey(upload.privateKeyPem);
  } catch {
    throw invalid(
      'The private key cannot be read. Upload an unencrypted PEM key (BEGIN PRIVATE KEY, RSA PRIVATE KEY or EC PRIVATE KEY).',
    );
  }
  return { certificates, key };
}

/** The leaf, then each issuer found in the upload, so the proxy sends a full chain. */
function orderChain(
  leaf: X509Certificate,
  certificates: readonly X509Certificate[],
): X509Certificate[] {
  const chain = [leaf];
  let current = leaf;
  for (;;) {
    const issuer = certificates.find(
      (candidate) =>
        !chain.includes(candidate) &&
        current.checkIssued(candidate) &&
        candidate.ca,
    );
    if (!issuer) return chain;
    chain.push(issuer);
    current = issuer;
  }
}

/** The DNS names of a certificate's subject alternative names, lowercase. */
function dnsNames(certificate: X509Certificate): string[] {
  return [
    ...new Set(
      (certificate.subjectAltName ?? '')
        .split(', ')
        .filter((entry) => entry.startsWith('DNS:'))
        .map((entry) => entry.slice(4).trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 100);
}

/** PKCS#12 bag types (RFC 7292). */
const CERT_BAG = '1.2.840.113549.1.12.10.1.3';
const KEY_BAG = '1.2.840.113549.1.12.10.1.1';
const SHROUDED_KEY_BAG = '1.2.840.113549.1.12.10.1.2';

const bagsOf = (p12: forge.pkcs12.Pkcs12Pfx, type: string) =>
  p12.getBags({ bagType: type })[type] ?? [];

const der = (asn1: forge.asn1.Asn1) =>
  Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
