import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// alphaci-app-routes writes one Caddy site per app address it finds in the
// agent's assignments. It needs bash and jq, so it runs on Linux runners.
// The appliance bundle sits at the monorepo root.
const script = resolve(
  __dirname,
  '../../../../../deploy/selfhost/alphaci-app-routes',
);
const posixOnly = process.platform === 'win32' ? describe.skip : describe;

function routes(settings: string, hosts: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'alphaci-routes-'));
  const install = join(root, 'install');
  const agent = join(root, 'agent');
  const bin = join(root, 'bin');
  mkdirSync(join(install, 'caddy', 'apps'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(install, 'alphaci.env'), settings);
  hosts.forEach((host, index) => {
    const dir = join(agent, 'assignments', 'project', `env${index}`);
    mkdirSync(dir, { recursive: true });
    const config = {
      ingress: { publicUrl: `https://${host}` },
      ports: [{ slot: 'frontend', hostPort: 8080 + index }],
    };
    writeFileSync(
      join(dir, 'pending.json'),
      JSON.stringify([{ assignment: { machine: { config } } }]),
    );
  });
  // The reload goes to the install's Caddy; here it only has to succeed.
  writeFileSync(join(bin, 'docker'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'docker'), 0o755);
  const run = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env['PATH']}`,
      ALPHACI_INSTALL_DIR: install,
      ALPHACI_HOME: agent,
    },
  });
  if (run.status !== 0) throw new Error(run.stderr);
  return readFileSync(join(install, 'caddy', 'apps', 'apps.caddy'), 'utf8');
}

posixOnly('alphaci-app-routes', () => {
  it('routes every address under the apps domain, with automatic TLS', () => {
    const out = routes('ONPREM_APPS_DOMAIN=apps.example.com\n', [
      'uat-shop.apps.example.com',
      'evil.example.org',
    ]);
    expect(out).toContain(
      'uat-shop.apps.example.com {\n\tencode zstd gzip\n\treverse_proxy host.docker.internal:8080\n}',
    );
    expect(out).not.toContain('evil.example.org');
  });

  it('with a label suffix, routes only names that end with it', () => {
    const out = routes(
      'ONPREM_APPS_DOMAIN=example.com\nONPREM_APPS_LABEL_SUFFIX=stpeter\n',
      ['uat-shop-stpeter.example.com', 'alphaci.example.com'],
    );
    expect(out).toContain('uat-shop-stpeter.example.com {');
    expect(out).not.toContain('alphaci.example.com {');
  });

  it('routes nothing when the suffix is invalid', () => {
    const out = routes(
      'ONPREM_APPS_DOMAIN=example.com\nONPREM_APPS_LABEL_SUFFIX=st.peter\n',
      ['uat-shop-st.peter.example.com', 'uat-shop.example.com'],
    );
    expect(out).not.toContain(' {');
  });

  it("uses Caddy's private CA for apps when the install does", () => {
    const out = routes(
      'ONPREM_APPS_DOMAIN=apps.example.com\nALPHACI_TLS_DIRECTIVE=internal\n',
      ['uat-shop.apps.example.com'],
    );
    expect(out).toContain(
      'uat-shop.apps.example.com {\n\ttls internal\n\tencode zstd gzip\n',
    );
  });
});

posixOnly('alphaci-app-routes with bound addresses', () => {
  // Reloads Caddy when the agent's bound-address files change, even without
  // an apps domain, and not otherwise.
  it('reloads once per change of a site or certificate', () => {
    const root = mkdtempSync(join(tmpdir(), 'alphaci-bindings-'));
    const install = join(root, 'install');
    const agent = join(root, 'agent');
    const bin = join(root, 'bin');
    const site = join(
      agent,
      'bindings',
      'a7f4ebb0-f23d-4da5-a704-52e07bf4cfeb',
    );
    mkdirSync(join(install, 'caddy', 'apps'), { recursive: true });
    mkdirSync(site, { recursive: true });
    mkdirSync(bin);
    writeFileSync(join(install, 'alphaci.env'), '');
    writeFileSync(join(site, 'site.caddy'), 'orders.acme.local {\n}\n');
    writeFileSync(join(site, 'cert.pem'), 'first');
    const log = join(root, 'docker.log');
    writeFileSync(join(bin, 'docker'), `#!/bin/sh\necho "$*" >> '${log}'\n`);
    chmodSync(join(bin, 'docker'), 0o755);
    const run = () => {
      const result = spawnSync('bash', [script], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env['PATH']}`,
          ALPHACI_INSTALL_DIR: install,
          ALPHACI_HOME: agent,
        },
      });
      if (result.status !== 0) throw new Error(result.stderr);
    };
    const reloads = () =>
      readFileSync(log, 'utf8')
        .split('\n')
        .filter((line) => line.includes('caddy reload')).length;
    run();
    expect(reloads()).toBe(1);
    run();
    expect(reloads()).toBe(1);
    writeFileSync(join(site, 'cert.pem'), 'renewed');
    run();
    expect(reloads()).toBe(2);
  });
});
