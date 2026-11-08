import { X509Certificate, createHash } from 'node:crypto';
import forge from 'node-forge';
import { parseCertificateUpload } from './onprem-certificate-parser';

/** A CA and a leaf it signed, made with node-forge so no key is committed. */
function issue(options: { names: string[]; days: number }) {
  const caKeys = forge.pki.rsa.generateKeyPair(1024);
  const ca = forge.pki.createCertificate();
  ca.publicKey = caKeys.publicKey;
  ca.serialNumber = '01';
  ca.validity.notBefore = new Date(Date.now() - 86_400_000);
  ca.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  ca.setSubject([{ name: 'commonName', value: 'Acme Internal CA' }]);
  ca.setIssuer([{ name: 'commonName', value: 'Acme Internal CA' }]);
  ca.setExtensions([{ name: 'basicConstraints', cA: true }]);
  ca.sign(caKeys.privateKey, forge.md.sha256.create());

  const keys = forge.pki.rsa.generateKeyPair(1024);
  const leaf = forge.pki.createCertificate();
  leaf.publicKey = keys.publicKey;
  leaf.serialNumber = '02';
  leaf.validity.notBefore = new Date(Date.now() - 2 * 86_400_000);
  leaf.validity.notAfter = new Date(Date.now() + options.days * 86_400_000);
  leaf.setSubject([{ name: 'commonName', value: options.names[0] ?? 'x' }]);
  leaf.setIssuer(ca.subject.attributes);
  leaf.setExtensions(
    options.names.length
      ? [
          {
            name: 'subjectAltName',
            altNames: options.names.map((value) => ({ type: 2, value })),
          },
        ]
      : [],
  );
  leaf.sign(caKeys.privateKey, forge.md.sha256.create());
  return { ca, leaf, key: keys.privateKey, caKey: caKeys.privateKey };
}

function pfx(
  issued: ReturnType<typeof issue>,
  password: string,
  chain = [issued.leaf, issued.ca],
  algorithm: 'aes256' | '3des' = '3des',
) {
  const asn1 = forge.pkcs12.toPkcs12Asn1(issued.key, chain, password, {
    algorithm,
  });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary').toString(
    'base64',
  );
}

describe('parseCertificateUpload', () => {
  const issued = issue({
    names: ['orders.acme.local', '*.shop.acme.local'],
    days: 200,
  });

  it('reads an IIS-style .pfx: chain leaf first, PKCS#8 key, names and dates', () => {
    const parsed = parseCertificateUpload({
      pfxBase64: pfx(issued, 'secret', [issued.ca, issued.leaf]),
      password: 'secret',
    });
    expect(parsed.hostnames).toEqual([
      'orders.acme.local',
      '*.shop.acme.local',
    ]);
    expect(parsed.issuer).toContain('Acme Internal CA');
    expect(parsed.certificatePem.match(/BEGIN CERTIFICATE/g)).toHaveLength(2);
    const [first] = parsed.certificatePem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
    )!;
    expect(new X509Certificate(first).subject).toContain('orders.acme.local');
    expect(parsed.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(parsed.sha256).toBe(
      createHash('sha256').update(parsed.certificatePem).digest('hex'),
    );
    expect(parsed.notAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('reads an AES-256 export, the Windows Server default', () => {
    expect(
      parseCertificateUpload({
        pfxBase64: pfx(issued, 'secret', [issued.leaf], 'aes256'),
        password: 'secret',
      }).hostnames,
    ).toContain('orders.acme.local');
  });

  it('says when the .pfx password is wrong', () => {
    expect(() =>
      parseCertificateUpload({
        pfxBase64: pfx(issued, 'secret'),
        password: 'nope',
      }),
    ).toThrow('The .pfx password is wrong.');
  });

  it('refuses a file that is not a .pfx', () => {
    expect(() =>
      parseCertificateUpload({
        pfxBase64: Buffer.from('not a pfx').toString('base64'),
        password: '',
      }),
    ).toThrow(/not a .pfx/);
  });

  it('reads a PEM chain and key', () => {
    const parsed = parseCertificateUpload({
      certificatePem:
        forge.pki.certificateToPem(issued.leaf) +
        forge.pki.certificateToPem(issued.ca),
      privateKeyPem: forge.pki.privateKeyToPem(issued.key),
    });
    expect(parsed.hostnames).toContain('orders.acme.local');
  });

  it('refuses a key that belongs to no certificate in the upload', () => {
    expect(() =>
      parseCertificateUpload({
        certificatePem: forge.pki.certificateToPem(issued.leaf),
        privateKeyPem: forge.pki.privateKeyToPem(issued.caKey),
      }),
    ).toThrow('The private key does not belong');
  });

  it('refuses an expired certificate and one without DNS names', () => {
    const expired = issue({ names: ['old.acme.local'], days: -1 });
    expect(() =>
      parseCertificateUpload({ pfxBase64: pfx(expired, 'x'), password: 'x' }),
    ).toThrow(/expired on/);
    const nameless = issue({ names: [], days: 30 });
    expect(() =>
      parseCertificateUpload({ pfxBase64: pfx(nameless, 'x'), password: 'x' }),
    ).toThrow(/no DNS names/);
  });
});
