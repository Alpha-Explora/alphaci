import {
  bindingProblem,
  bindingStatusView,
  bytesToBase64,
  certificateCovers,
  certificateDraftProblem,
  certificateExpiryLabel,
  certificateExpiryTone,
  certificateUpload,
  dnsRecord,
  emptyCertificateDraft,
  hostnameProblem,
  isIpAddress,
  listenAddressProblem,
  tlsChoice,
  tlsFromChoice,
  withBindingField,
  withIngressMode,
  type AddressBinding,
  type Certificate,
} from './address-binding';

const now = Date.parse('2026-11-08T00:00:00Z');
const certificate = (overrides: Partial<Certificate> = {}): Certificate => ({
  id: 'c1',
  name: 'Orders 2027',
  hostnames: ['orders.acme.local'],
  issuer: 'Acme CA',
  notBefore: '2026-01-01T00:00:00Z',
  notAfter: '2027-06-01T00:00:00Z',
  sha256: 'a'.repeat(64),
  createdAt: '2026-11-01T00:00:00Z',
  inUse: 0,
  ...overrides,
});
const binding = (overrides: Partial<AddressBinding> = {}): AddressBinding => ({
  hostname: 'orders.acme.local',
  listenAddress: null,
  tls: { kind: 'acme' },
  ...overrides,
});

describe('hostnameProblem', () => {
  it.each(['orders.acme.local', 'a-b.example.com', 'x1.y2.z3'])(
    'accepts %s',
    (hostname) => expect(hostnameProblem(hostname)).toBeNull(),
  );
  it.each([
    ['', 'Enter the hostname users will open.'],
    [
      'https://orders.acme.local',
      'Enter only the hostname, without https:// or a port.',
    ],
    [
      'orders.acme.local:443',
      'Enter only the hostname, without https:// or a port.',
    ],
    ['*.acme.local', 'Wildcard hostnames cannot be bound.'],
    ['Orders.acme.local', 'Use lowercase letters.'],
    ['localhost', 'Enter a DNS name such as orders.example.com.'],
    ['-bad.acme.local', 'Enter a DNS name such as orders.example.com.'],
    ['two..dots', 'Enter a DNS name such as orders.example.com.'],
    ['has space.acme.local', 'Enter a DNS name such as orders.example.com.'],
  ])('refuses %j', (hostname, message) =>
    expect(hostnameProblem(hostname)).toBe(message),
  );
});

it('accepts IPv4 and IPv6 literals as listen addresses, or nothing', () => {
  expect(isIpAddress('10.0.0.5')).toBe(true);
  expect(isIpAddress('::1')).toBe(true);
  expect(isIpAddress('fe80::1:2')).toBe(true);
  expect(isIpAddress('256.1.1.1')).toBe(false);
  expect(isIpAddress('10.0.0')).toBe(false);
  expect(isIpAddress('server01')).toBe(false);
  expect(isIpAddress('1:2:3:4:5:6:7:8:9')).toBe(false);
  expect(listenAddressProblem(null)).toBeNull();
  expect(listenAddressProblem('')).toBeNull();
  expect(listenAddressProblem('server01')).toMatch(/IPv4 or IPv6/);
});

it('matches certificate names exactly, and wildcards on one label only', () => {
  const wildcard = { hostnames: ['*.acme.local'] };
  expect(certificateCovers(certificate(), 'orders.acme.local')).toBe(true);
  expect(certificateCovers(certificate(), 'shop.acme.local')).toBe(false);
  expect(certificateCovers(wildcard, 'orders.acme.local')).toBe(true);
  expect(certificateCovers(wildcard, 'a.orders.acme.local')).toBe(false);
  expect(certificateCovers(wildcard, 'acme.local')).toBe(false);
});

it('labels expiry: valid, a warning within 30 days, an error once expired', () => {
  expect(certificateExpiryLabel(certificate(), now)).toBe('Expires 2027-06-01');
  expect(certificateExpiryTone(certificate(), now)).toBe('success');
  const soon = certificate({ notAfter: '2026-11-20T00:00:00Z' });
  expect(certificateExpiryLabel(soon, now)).toBe('Expires in 12 days');
  expect(certificateExpiryTone(soon, now)).toBe('amber');
  const tomorrow = certificate({ notAfter: '2026-11-09T12:00:00Z' });
  expect(certificateExpiryLabel(tomorrow, now)).toBe('Expires in 1 day');
  const old = certificate({ notAfter: '2026-10-01T00:00:00Z' });
  expect(certificateExpiryLabel(old, now)).toBe('Expired 2026-10-01');
  expect(certificateExpiryTone(old, now)).toBe('danger');
});

describe('bindingProblem', () => {
  const context = { production: false, certificates: [certificate()], now };
  it('accepts a valid binding with each kind of certificate', () => {
    expect(bindingProblem(binding(), context)).toBeNull();
    expect(
      bindingProblem(binding({ tls: { kind: 'internal' } }), context),
    ).toBeNull();
    expect(
      bindingProblem(
        binding({
          listenAddress: '10.0.0.5',
          tls: { kind: 'certificate', certificateId: 'c1' },
        }),
        context,
      ),
    ).toBeNull();
  });
  it('checks the hostname and listen address first', () => {
    expect(bindingProblem(binding({ hostname: '' }), context)).toMatch(
      /hostname/,
    );
    expect(bindingProblem(binding({ listenAddress: 'nope' }), context)).toMatch(
      /IPv4 or IPv6/,
    );
  });
  it('refuses the internal CA for production', () => {
    expect(
      bindingProblem(binding({ tls: { kind: 'internal' } }), {
        ...context,
        production: true,
      }),
    ).toBe('Production needs an uploaded or automatic certificate.');
  });
  it('refuses a missing, unknown, expired or non-covering certificate', () => {
    const tls = (certificateId: string) =>
      binding({ tls: { kind: 'certificate', certificateId } });
    expect(bindingProblem(tls(''), context)).toBe('Choose a certificate.');
    expect(bindingProblem(tls('gone'), context)).toMatch(/no longer exists/);
    expect(
      bindingProblem(tls('c1'), {
        ...context,
        certificates: [certificate({ notAfter: '2026-01-01T00:00:00Z' })],
      }),
    ).toMatch(/has expired/);
    expect(
      bindingProblem(
        binding({
          hostname: 'shop.acme.local',
          tls: { kind: 'certificate', certificateId: 'c1' },
        }),
        context,
      ),
    ).toBe('Orders 2027 does not cover shop.acme.local.');
  });
});

it('round-trips the certificate picker values', () => {
  for (const tls of [
    { kind: 'acme' },
    { kind: 'internal' },
    { kind: 'certificate', certificateId: 'c1' },
  ] as const)
    expect(tlsFromChoice(tlsChoice(tls))).toEqual(tls);
});

it('describes the DNS record to create', () => {
  expect(dnsRecord(binding())).toEqual({
    type: 'A',
    name: 'orders.acme.local',
    value: "this machine's IP address",
  });
  expect(dnsRecord(binding({ listenAddress: '10.0.0.5' }))).toMatchObject({
    type: 'A',
    value: '10.0.0.5',
  });
  expect(dnsRecord(binding({ listenAddress: 'fd00::5' }))).toMatchObject({
    type: 'AAAA',
  });
});

describe('withIngressMode', () => {
  it('starts a bound address blank on ACME, with no public URL', () => {
    expect(
      withIngressMode(
        { mode: 'configured', publicUrl: 'https://a.b' },
        'bound',
      ),
    ).toEqual({
      mode: 'bound',
      publicUrl: null,
      binding: { hostname: '', listenAddress: null, tls: { kind: 'acme' } },
    });
  });
  it('restores a binding typed before switching away', () => {
    const typed = binding({ listenAddress: '10.0.0.5' });
    expect(
      withIngressMode({ mode: 'direct', publicUrl: null }, 'bound', typed),
    ).toMatchObject({ binding: typed });
  });
  it('keeps a configured URL, and drops it for the other modes', () => {
    const configured = {
      mode: 'configured',
      publicUrl: 'https://a.b',
    } as const;
    expect(withIngressMode(configured, 'configured')).toEqual(configured);
    expect(withIngressMode(configured, 'tunnel')).toEqual({
      mode: 'tunnel',
      publicUrl: null,
    });
    expect(
      withIngressMode(
        { mode: 'bound', publicUrl: 'https://x.y', binding: binding() },
        'configured',
      ),
    ).toEqual({ mode: 'configured', publicUrl: null });
  });
});

it('lowercases a typed hostname and stores an empty listen address as null', () => {
  expect(
    withBindingField(binding(), 'hostname', ' Orders.Acme.Local '),
  ).toEqual(binding());
  expect(
    withBindingField(
      binding({ listenAddress: '10.0.0.5' }),
      'listenAddress',
      ' ',
    ),
  ).toEqual(binding());
});

it("shows the machine's binding report, with a sentence for each status", () => {
  expect(bindingStatusView(null)).toEqual({
    label: 'Waiting',
    tone: 'muted',
    message: 'Waiting for the machine to report the address.',
  });
  expect(
    bindingStatusView({
      status: 'failed',
      message: 'Port 443 is already used by another program.',
      reportedAt: '2026-11-08T00:00:00Z',
    }),
  ).toEqual({
    label: 'Failed',
    tone: 'danger',
    message: 'Port 443 is already used by another program.',
  });
  expect(
    bindingStatusView({ status: 'running', message: ' ', reportedAt: null }),
  ).toMatchObject({ label: 'Serving', tone: 'success' });
});

describe('certificate drafts', () => {
  it('needs a name and a .pfx file; the password may be empty', () => {
    const draft = emptyCertificateDraft('pfx');
    expect(certificateDraftProblem(draft)).toBe('Name the certificate.');
    const named = { ...draft, name: 'Orders' };
    expect(certificateDraftProblem(named)).toBe('Choose a .pfx or .p12 file.');
    const ready = { ...named, pfxBase64: 'AAEC', fileName: 'o.pfx' };
    expect(certificateDraftProblem(ready)).toBeNull();
    expect(certificateUpload({ ...ready, name: ' Orders ' })).toEqual({
      name: 'Orders',
      pfxBase64: 'AAEC',
      password: '',
    });
  });
  it('needs a PEM certificate and a PEM private key', () => {
    const draft = { ...emptyCertificateDraft('pem'), name: 'Orders' };
    expect(certificateDraftProblem(draft)).toMatch(/certificate in PEM/);
    const cert = {
      ...draft,
      certificatePem:
        '-----BEGIN CERTIFICATE-----\nMII\n-----END CERTIFICATE-----\n',
    };
    expect(certificateDraftProblem(cert)).toMatch(/private key in PEM/);
    const ready = {
      ...cert,
      privateKeyPem:
        '-----BEGIN RSA PRIVATE KEY-----\nMII\n-----END RSA PRIVATE KEY-----',
    };
    expect(certificateDraftProblem(ready)).toBeNull();
    expect(certificateUpload(ready)).toEqual({
      name: 'Orders',
      certificatePem:
        '-----BEGIN CERTIFICATE-----\nMII\n-----END CERTIFICATE-----',
      privateKeyPem: ready.privateKeyPem,
    });
  });
});

it('encodes file bytes as base64', () => {
  expect(bytesToBase64(new Uint8Array([0, 1, 2, 250]))).toBe('AAEC+g==');
  expect(bytesToBase64(new Uint8Array(70_000)).length).toBe(93_336);
});
