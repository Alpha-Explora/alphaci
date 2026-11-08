import {
  BINDING_AGENT_VERSION,
  UNKNOWN_BINDING_STATE,
  UPDATE_AGENT_FOR_BINDING,
  WAITING_FOR_BINDING,
  bindingReadiness,
  bindingReport,
  certificateCovers,
  isBindingHostname,
  normalizeBinding,
  parseBindingReport,
} from './onprem-binding';

const ID = '3f0e8a52-6b1c-4d1e-9a51-0b7f6c2d9e10';

describe('bound address rules', () => {
  it.each(['orders.acme.local', 'a.b', 'x-1.example.com'])(
    'accepts %s as a hostname',
    (name) => expect(isBindingHostname(name)).toBe(true),
  );
  it.each([
    'localhost',
    'https://orders.acme.local',
    'orders.acme.local:443',
    '*.acme.local',
    '10.0.0.5',
    '-bad.acme.local',
    'Orders.acme.local',
  ])('refuses %s as a hostname', (name) =>
    expect(isBindingHostname(name)).toBe(false),
  );

  it('normalizes case, a trailing dot and an empty listen address', () => {
    expect(
      normalizeBinding(
        {
          hostname: ' Orders.Acme.Local. ',
          listenAddress: '  ',
          tls: { kind: 'acme' },
        },
        false,
      ),
    ).toEqual({
      binding: {
        hostname: 'orders.acme.local',
        listenAddress: null,
        tls: { kind: 'acme' },
      },
    });
  });

  it('accepts IPv4 and IPv6 listen addresses and refuses others', () => {
    const tls = { kind: 'acme' };
    for (const listenAddress of ['10.0.0.5', '2001:db8::5'])
      expect(
        normalizeBinding(
          { hostname: 'a.example.com', listenAddress, tls },
          false,
        ),
      ).toHaveProperty('binding.listenAddress', listenAddress);
    for (const listenAddress of ['10.0.0.256', 'fe80::1%eth0', 'host', 5])
      expect(
        normalizeBinding(
          { hostname: 'a.example.com', listenAddress, tls },
          false,
        ),
      ).toHaveProperty('error');
  });

  it('refuses the internal certificate for production only', () => {
    const input = { hostname: 'a.example.com', tls: { kind: 'internal' } };
    expect(normalizeBinding(input, false)).toHaveProperty('binding');
    expect(normalizeBinding(input, true)).toHaveProperty('error');
  });

  it('needs a certificate id for an uploaded certificate', () => {
    expect(
      normalizeBinding(
        { hostname: 'a.example.com', tls: { kind: 'certificate' } },
        false,
      ),
    ).toHaveProperty('error');
    expect(
      normalizeBinding(
        {
          hostname: 'a.example.com',
          tls: { kind: 'certificate', certificateId: ID.toUpperCase() },
        },
        true,
      ),
    ).toHaveProperty('binding.tls', { kind: 'certificate', certificateId: ID });
  });

  it('matches certificate names as browsers do', () => {
    expect(certificateCovers(['orders.acme.local'], 'orders.acme.local')).toBe(
      true,
    );
    expect(certificateCovers(['*.acme.local'], 'orders.acme.local')).toBe(true);
    expect(certificateCovers(['*.acme.local'], 'a.orders.acme.local')).toBe(
      false,
    );
    expect(certificateCovers(['*.acme.local'], 'acme.local')).toBe(false);
    expect(certificateCovers(['shop.acme.local'], 'orders.acme.local')).toBe(
      false,
    );
  });
});

describe('binding reports', () => {
  it('keeps a valid report and marks an unknown state failed', () => {
    expect(
      parseBindingReport({
        assignmentId: ID,
        status: 'running',
        message: 'ok',
      }),
    ).toEqual({ assignmentId: ID, status: 'running', message: 'ok' });
    expect(
      parseBindingReport({ assignmentId: ID, status: 'weird', message: 'x' }),
    ).toEqual({
      assignmentId: ID,
      status: 'failed',
      message: UNKNOWN_BINDING_STATE,
    });
    expect(
      parseBindingReport({ assignmentId: 'nope', status: 'running' }),
    ).toBeNull();
  });

  it('shows waiting until a fresh report arrives', () => {
    expect(
      bindingReport({
        status: 'running',
        message: 'ok',
        reportedAt: null,
        fresh: false,
      }),
    ).toMatchObject({ status: 'waiting', message: WAITING_FOR_BINDING });
  });
});

describe('binding readiness', () => {
  const now = new Date('2026-11-08T00:00:00Z');
  const binding = {
    hostname: 'orders.acme.local',
    listenAddress: '10.0.0.5',
    tls: { kind: 'certificate' as const, certificateId: ID },
  };
  const running = {
    status: 'running' as const,
    message: 'ok',
    reportedAt: null,
  };
  const certificate = (notAfter: string) => ({
    name: 'Orders',
    notAfter: new Date(notAfter),
    deleted: false,
  });

  it('asks for an agent update first', () => {
    expect(
      bindingReadiness(
        binding,
        running,
        '0.4.3',
        certificate('2027-06-01'),
        now,
      ),
    ).toEqual({ status: 'failed', message: UPDATE_AGENT_FOR_BINDING });
  });

  it('fails for an expired or deleted certificate', () => {
    expect(
      bindingReadiness(
        binding,
        running,
        BINDING_AGENT_VERSION,
        certificate('2026-11-01'),
        now,
      ).message,
    ).toContain('expired on 2026-11-01');
    expect(
      bindingReadiness(
        binding,
        running,
        BINDING_AGENT_VERSION,
        { ...certificate('2027-06-01'), deleted: true },
        now,
      ).status,
    ).toBe('failed');
  });

  it('passes on the machine failure message', () => {
    expect(
      bindingReadiness(
        binding,
        { status: 'failed', message: 'Port 443 is in use.', reportedAt: null },
        BINDING_AGENT_VERSION,
        certificate('2027-06-01'),
        now,
      ),
    ).toEqual({ status: 'failed', message: 'Port 443 is in use.' });
  });

  it('names the DNS record and warns 30 days before expiry', () => {
    const ready = bindingReadiness(
      binding,
      running,
      BINDING_AGENT_VERSION,
      certificate('2026-11-20'),
      now,
    );
    expect(ready.status).toBe('unverified');
    expect(ready.message).toContain(
      'Point DNS for orders.acme.local at 10.0.0.5',
    );
    expect(ready.message).toContain('expires on 2026-11-20');
    expect(
      bindingReadiness(
        binding,
        running,
        BINDING_AGENT_VERSION,
        certificate('2027-06-01'),
        now,
      ).message,
    ).not.toContain('expires');
  });
});
