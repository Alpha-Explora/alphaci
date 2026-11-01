import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A forward proxy that refuses every request and records where it was going.
 *
 * The API and the web server are started with `env`, which turns on Node's
 * NODE_USE_ENV_PROXY: every HTTP(S) request they make through `http`, `https`
 * or `fetch` to a host other than loopback goes to this proxy instead, fails at
 * once, and is listed in `attempts`. A run with any attempt fails, so a
 * provider call that the test configuration did not switch off is caught rather
 * than reaching GitHub, Vercel, Render or GCP.
 *
 * Raw TCP clients (`pg`) bypass it; the only database is the loopback fixture.
 */
export interface EgressGuard {
  readonly attempts: string[];
  readonly env: Readonly<Record<string, string>>;
  close(): Promise<void>;
}

export async function startEgressGuard(): Promise<EgressGuard> {
  const attempts: string[] = [];
  const server = createServer((request, response) => {
    attempts.push(`${request.method ?? 'GET'} ${request.url ?? ''}`);
    response.writeHead(403).end('Blocked by the full-stack egress guard.\n');
  });
  server.on('connect', (request, socket) => {
    attempts.push(`CONNECT ${request.url ?? ''}`);
    socket.on('error', () => undefined);
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const proxy = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    attempts,
    env: {
      NODE_USE_ENV_PROXY: '1',
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
      NO_PROXY: 'localhost,127.0.0.1,::1',
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
