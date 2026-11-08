import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import forge from 'node-forge';
import {
  buildShellFixture,
  shellFixture,
} from './support/onprem-shell-fixture';

type Fixture = ReturnType<typeof shellFixture>;

/** A self-signed certificate and its key, as AlphaCI would deliver them. */
function certificatePair(hostname: string) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: 'commonName', value: hostname }]);
  cert.setIssuer([{ name: 'commonName', value: hostname }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const certificatePem = forge.pki.certificateToPem(cert);
  return {
    certificatePem,
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    sha256: createHash('sha256').update(certificatePem).digest('hex'),
  };
}

describe('Bound addresses (IIS-style bindings) with recording fixture', () => {
  beforeAll(buildShellFixture);
  const lines = (file: string) =>
    existsSync(file)
      ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
      : [];
  const dockerCalls = (f: Fixture) => lines(join(f.work, 'docker.log'));
  const requests = (f: Fixture) => lines(join(f.work, 'requests.log'));
  const dir = (f: Fixture, environmentId: string) =>
    join(f.work, 'host/bindings', environmentId);
  const report = (f: Fixture, environmentId: string) =>
    JSON.parse(
      readFileSync(join(dir(f, environmentId), 'binding-report.json'), 'utf8'),
    ) as { assignmentId: string; status: string; message: string };
  function order(
    tls: Record<string, string>,
    extra: Record<string, unknown> = {},
  ) {
    return {
      assignmentId: randomUUID(),
      projectId: randomUUID(),
      environmentId: randomUUID(),
      hostPort: 18300,
      hostname: 'orders.acme.local',
      listenAddress: null,
      tls,
      ...extra,
    };
  }
  const reply = (f: Fixture, bindings: unknown[]) =>
    writeFileSync(
      join(f.work, 'heartbeat-reply.json'),
      JSON.stringify({ ports: [18300], tunnels: [], bindings }),
    );
  const checkIn = '/work/host/bin/alphaci-supervisor --heartbeat-only';

  it('writes the site, starts the edge proxy, and reports it in the next heartbeat', () => {
    const f = shellFixture();
    const bound = order({ kind: 'acme' });
    reply(f, [bound]);
    f.run(checkIn);
    expect(
      readFileSync(join(dir(f, bound.environmentId), 'site.caddy'), 'utf8'),
    ).toContain(
      'orders.acme.local {\n\tencode zstd gzip\n\treverse_proxy {$ALPHACI_APP_UPSTREAM}:18300\n}',
    );
    const runs = dockerCalls(f).filter((line) => line.startsWith('run -d'));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toContain('--name alphaci-edge --network host');
    expect(runs[0]).toContain('-e ALPHACI_APP_UPSTREAM=127.0.0.1');
    expect(runs[0]).toContain('caddy:2-alpine');
    expect(report(f, bound.environmentId)).toMatchObject({
      assignmentId: bound.assignmentId,
      status: 'starting',
    });
    // A Windows host forwards these into WSL, so the proxy's ports are listed.
    expect(
      JSON.parse(
        readFileSync(join(f.work, 'host/published-ports.json'), 'utf8'),
      ),
    ).toEqual([80, 443, 18300]);
    f.run(checkIn);
    const body = JSON.parse(
      readFileSync(join(f.work, 'heartbeat-body.json'), 'utf8'),
    ) as { agentVersion: string; bindings: Array<Record<string, unknown>> };
    expect(body.agentVersion).toBe('0.5.0');
    expect(body.bindings).toEqual([
      expect.objectContaining({ assignmentId: bound.assignmentId }),
    ]);
  });

  it('downloads an uploaded certificate once, and again only when its hash changes', () => {
    const f = shellFixture();
    const first = certificatePair('orders.acme.local');
    const id = randomUUID();
    const bound = order({
      kind: 'certificate',
      certificateId: id,
      sha256: first.sha256,
    });
    writeFileSync(
      join(f.work, 'certificate.json'),
      JSON.stringify({ id, ...first }),
    );
    reply(f, [bound]);
    f.run(`${checkIn}; ${checkIn}`);
    expect(
      requests(f).filter((line) => line.startsWith('certificate')),
    ).toEqual([`certificate ${id}`]);
    const files = dir(f, bound.environmentId);
    expect(readFileSync(join(files, 'cert.pem'), 'utf8')).toBe(
      first.certificatePem,
    );
    expect(readFileSync(join(files, 'site.caddy'), 'utf8')).toContain(
      `\ttls /bindings/${bound.environmentId}/cert.pem /bindings/${bound.environmentId}/key.pem\n`,
    );
    expect(
      f
        .run(`stat -c %a /work/host/bindings/${bound.environmentId}/key.pem`)
        .trim(),
    ).toBe('600');
    const renewed = certificatePair('orders.acme.local');
    writeFileSync(
      join(f.work, 'certificate.json'),
      JSON.stringify({ id, ...renewed }),
    );
    reply(f, [{ ...bound, tls: { ...bound.tls, sha256: renewed.sha256 } }]);
    f.run(checkIn);
    expect(
      requests(f).filter((line) => line.startsWith('certificate')),
    ).toHaveLength(2);
    expect(readFileSync(join(files, 'cert.pem'), 'utf8')).toBe(
      renewed.certificatePem,
    );
  });

  it('refuses a certificate whose key does not match, and serves nothing for it', () => {
    const f = shellFixture();
    const pair = certificatePair('orders.acme.local');
    const other = certificatePair('orders.acme.local');
    const id = randomUUID();
    const bound = order({
      kind: 'certificate',
      certificateId: id,
      sha256: pair.sha256,
    });
    writeFileSync(
      join(f.work, 'certificate.json'),
      JSON.stringify({ id, ...pair, privateKeyPem: other.privateKeyPem }),
    );
    reply(f, [bound]);
    f.run(checkIn);
    expect(existsSync(join(dir(f, bound.environmentId), 'site.caddy'))).toBe(
      false,
    );
    expect(existsSync(join(dir(f, bound.environmentId), 'key.pem'))).toBe(
      false,
    );
    expect(report(f, bound.environmentId).status).toBe('failed');
    expect(report(f, bound.environmentId).message).toContain(
      'does not match its private key',
    );
  });

  it('validates hostname and listen address again before writing any configuration', () => {
    const f = shellFixture();
    const badName = order({ kind: 'acme' }, { hostname: 'x {\n}\nevil.local' });
    const badAddress = order(
      { kind: 'acme' },
      { hostname: 'b.acme.local', listenAddress: '10.0.0.999' },
    );
    const absent = order(
      { kind: 'acme' },
      { hostname: 'c.acme.local', listenAddress: '10.9.9.9' },
    );
    reply(f, [badName, badAddress, absent]);
    f.run(checkIn);
    for (const bound of [badName, badAddress, absent])
      expect(existsSync(join(dir(f, bound.environmentId), 'site.caddy'))).toBe(
        false,
      );
    expect(report(f, badName.environmentId).message).toContain(
      'invalid hostname',
    );
    expect(report(f, badAddress.environmentId).message).toContain(
      'invalid listen address',
    );
    expect(report(f, absent.environmentId).message).toContain(
      '10.9.9.9 is not an address of this machine',
    );
    // Nothing to serve: the proxy is not started.
    expect(dockerCalls(f).some((line) => line.startsWith('run -d'))).toBe(
      false,
    );
  });

  it('binds a listen address that is on this machine', () => {
    const f = shellFixture();
    writeFileSync(
      join(f.work, 'bin/ip'),
      '#!/bin/bash\necho "2: eth0    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0"\n',
    );
    const bound = order({ kind: 'internal' }, { listenAddress: '10.0.0.5' });
    reply(f, [bound]);
    f.run(checkIn);
    expect(
      readFileSync(join(dir(f, bound.environmentId), 'site.caddy'), 'utf8'),
    ).toContain('orders.acme.local {\n\tbind 10.0.0.5\n\ttls internal\n');
  });

  it('on the AlphaCI server, only writes the files and refuses a listen address', () => {
    const f = shellFixture();
    writeFileSync(join(f.work, 'host/edge-mode'), 'appliance\n');
    const served = order({ kind: 'acme' });
    const pinned = order(
      { kind: 'acme' },
      { hostname: 'shop.acme.local', listenAddress: '10.0.0.5' },
    );
    reply(f, [served, pinned]);
    f.run(checkIn);
    expect(dockerCalls(f).some((line) => line.startsWith('run'))).toBe(false);
    expect(existsSync(join(dir(f, served.environmentId), 'site.caddy'))).toBe(
      true,
    );
    expect(
      JSON.parse(
        readFileSync(join(f.work, 'host/published-ports.json'), 'utf8'),
      ),
    ).toEqual([18300]);
    expect(report(f, served.environmentId)).toMatchObject({
      status: 'running',
      message: "The AlphaCI server's proxy serves this address.",
    });
    expect(report(f, pinned.environmentId).status).toBe('failed');
    expect(report(f, pinned.environmentId).message).toContain(
      'This machine is the AlphaCI server',
    );
  });

  it('removes a binding that left the machine, and stops the proxy when none remain', () => {
    const f = shellFixture();
    const bound = order({ kind: 'acme' });
    reply(f, [bound]);
    f.run(checkIn);
    reply(f, []);
    f.run(checkIn);
    expect(existsSync(dir(f, bound.environmentId))).toBe(false);
    expect(dockerCalls(f)).toContain('rm -f alphaci-edge');
  });

  it('ends every binding and its key when the credential is rejected', () => {
    const f = shellFixture();
    const bound = order({ kind: 'acme' });
    reply(f, [bound]);
    f.run(checkIn);
    writeFileSync(join(f.work, 'revoked'), '1');
    try {
      f.run(checkIn);
    } catch {
      // The supervisor exits 1 after a 401.
    }
    expect(existsSync(dir(f, bound.environmentId))).toBe(false);
  });

  it('treats a reply from an older server as no bindings', () => {
    const f = shellFixture();
    writeFileSync(
      join(f.work, 'heartbeat-reply.json'),
      JSON.stringify({ ports: [], tunnels: [] }),
    );
    f.run(checkIn);
    expect(dockerCalls(f).some((line) => line.startsWith('run'))).toBe(false);
  });
});
