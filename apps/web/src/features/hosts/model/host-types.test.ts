import {
  canManageHosts,
  countdownLabel,
  enrollmentProgress,
  hostStatusTone,
  lastSeenLabel,
  hostConnectionLabel,
  reachedAt,
  requestedConfig,
  TUNNEL_WAITING_MESSAGE,
  type AssignmentConfig,
  type MachineSummary,
  type TunnelReport,
} from './host-types';
const host: MachineSummary = {
  id: 'm',
  workspaceId: 'w',
  name: 'test',
  platform: 'ubuntu',
  agentVersion: '1',
  lastSeenAt: '2026-10-15T00:00:00Z',
  status: 'connected',
  checks: [],
};
it('expires connection evidence after ninety seconds without claiming application health', () => {
  expect(hostConnectionLabel(host, Date.parse(host.lastSeenAt!) + 90_001)).toBe(
    'Offline',
  );
  expect(hostConnectionLabel(host, Date.parse(host.lastSeenAt!) + 89_000)).toBe(
    'Connected',
  );
});
it('denies management to viewers and non-hosting personas', () => {
  expect(canManageHosts('member', 'viewer')).toBe(false);
  expect(canManageHosts('qa', 'admin')).toBe(false);
  expect(canManageHosts('lead', 'admin')).toBe(false);
  expect(canManageHosts('member', 'member')).toBe(true);
});
describe('enrollmentProgress', () => {
  const receipt = { id: 'e1', expiresAt: '2026-10-15T00:15:00Z' };
  const now = Date.parse('2026-10-15T00:05:00Z');
  const pending: MachineSummary = {
    ...host,
    id: 'e1',
    name: 'box',
    status: 'enrollment_pending',
    lastSeenAt: null,
  };
  it('waits while the enrollment row is still pending', () => {
    expect(enrollmentProgress(receipt, 'box', [pending], now)).toBe('waiting');
  });
  it('reports connected once a machine with that name replaces the pending row', () => {
    expect(
      enrollmentProgress(
        receipt,
        'box',
        [{ ...host, id: 'm2', name: 'box' }],
        now,
      ),
    ).toBe('connected');
  });
  it('expires an unused code', () => {
    expect(
      enrollmentProgress(
        receipt,
        'box',
        [pending],
        Date.parse(receipt.expiresAt),
      ),
    ).toBe('expired');
  });
});
describe('reachedAt', () => {
  const configWith = (
    ingress: AssignmentConfig['ingress'],
  ): AssignmentConfig => ({ ports: [], health: [], ingress });
  const tunnel = configWith({ mode: 'tunnel', publicUrl: null });
  const report = (overrides: Partial<TunnelReport>): TunnelReport => ({
    status: 'waiting',
    publicUrl: null,
    message: '',
    reportedAt: null,
    ...overrides,
  });
  it('links the tunnel address the machine reported', () => {
    expect(
      reachedAt(
        tunnel,
        report({
          status: 'running',
          publicUrl: 'https://quick-words.trycloudflare.com',
          message: 'The tunnel is running.',
        }),
      ),
    ).toEqual({ kind: 'link', href: 'https://quick-words.trycloudflare.com' });
  });
  it('says it is waiting until the machine reports an address', () => {
    expect(reachedAt(tunnel, null)).toEqual({
      kind: 'text',
      text: TUNNEL_WAITING_MESSAGE,
    });
    expect(reachedAt(tunnel, report({ status: 'waiting' }))).toEqual({
      kind: 'text',
      text: TUNNEL_WAITING_MESSAGE,
    });
  });
  it("shows the machine's own sentence when there is no address", () => {
    const sentence = 'The tunnel client could not start on this machine.';
    expect(
      reachedAt(tunnel, report({ status: 'unavailable', message: sentence })),
    ).toEqual({ kind: 'text', text: sentence });
    expect(
      reachedAt(tunnel, report({ status: 'failed', message: sentence })),
    ).toEqual({ kind: 'text', text: sentence });
  });
  it("links a bound address at the server's URL, or its hostname", () => {
    const binding = {
      hostname: 'orders.acme.local',
      listenAddress: null,
      tls: { kind: 'acme' as const },
    };
    expect(
      reachedAt(
        configWith({
          mode: 'bound',
          publicUrl: 'https://orders.acme.local',
          binding,
        }),
        null,
      ),
    ).toEqual({ kind: 'link', href: 'https://orders.acme.local' });
    expect(
      reachedAt(configWith({ mode: 'bound', publicUrl: null, binding }), null),
    ).toEqual({ kind: 'link', href: 'https://orders.acme.local' });
  });
  it('keeps a configured URL as a link and direct on the host port', () => {
    expect(
      reachedAt(
        configWith({
          mode: 'configured',
          publicUrl: 'https://app.example.com',
        }),
        null,
      ),
    ).toEqual({ kind: 'link', href: 'https://app.example.com' });
    expect(
      reachedAt(configWith({ mode: 'direct', publicUrl: null }), null),
    ).toEqual({ kind: 'text', text: 'host port on the local network' });
  });
});
it('maps connection labels to tones and formats the code countdown', () => {
  expect(hostStatusTone('Connected')).toBe('success');
  expect(hostStatusTone('Prerequisites failed')).toBe('danger');
  expect(
    countdownLabel('2026-10-15T00:10:05Z', Date.parse('2026-10-15T00:00:00Z')),
  ).toBe('10:05');
  expect(lastSeenLabel(null)).toBe('Never connected');
});

it('sends no host ports, and no public URL for a bound address', () => {
  const binding = {
    hostname: 'orders.acme.local',
    listenAddress: '10.0.0.5',
    tls: { kind: 'certificate' as const, certificateId: 'c1' },
  };
  expect(
    requestedConfig({
      ports: [{ slot: 'frontend', hostPort: 8080, containerPort: 3000 }],
      health: [{ slot: 'frontend', path: '/' }],
      ingress: {
        mode: 'bound',
        publicUrl: 'https://orders.acme.local',
        binding,
      },
    }),
  ).toEqual({
    ports: [{ slot: 'frontend', containerPort: 3000 }],
    health: [{ slot: 'frontend', path: '/' }],
    ingress: { mode: 'bound', publicUrl: null, binding },
  });
  const configured = {
    mode: 'configured' as const,
    publicUrl: 'https://app.example.com',
  };
  expect(
    requestedConfig({ ports: [], health: [], ingress: configured }).ingress,
  ).toBe(configured);
});
