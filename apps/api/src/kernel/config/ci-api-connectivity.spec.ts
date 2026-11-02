import { runInNewContext } from 'node:vm';

import {
  CI_API_CONNECTIVITY_PREFLIGHT,
  validateCiApiConnectivity,
} from './ci-api-connectivity';

type Execution = 'github-hosted' | 'private-network';

const REJECTED_FOR_GITHUB_HOSTED = [
  'http://localhost:4000',
  'https://127.1',
  'https://2130706433',
  'https://[::1]',
  'https://10.0.0.2',
  'https://172.16.2.3',
  'https://192.168.1.3',
  'https://169.254.169.254',
  'https://100.64.0.1',
  'https://[::ffff:127.0.0.1]',
  'https://[fc00::1]',
  'https://api.local',
  'https://a:b@api.example.com',
  'http://api.example.com',
];

const CASES: [string, Execution][] = [
  ...REJECTED_FOR_GITHUB_HOSTED.map((url): [string, Execution] => [
    url,
    'github-hosted',
  ]),
  ['https://api.example.com/api/v1', 'github-hosted'],
  ['https://api.example.com.', 'github-hosted'],
  ['https://[2001:db8::1]', 'github-hosted'],
  ['https://8.8.8.8', 'github-hosted'],
  ['https://0.1.2.3', 'github-hosted'],
  ['https://224.0.0.1', 'github-hosted'],
  ['https://198.18.0.1', 'github-hosted'],
  ['https://192.0.2.1', 'github-hosted'],
  ['https://intranet', 'github-hosted'],
  ['https://ci.corp.internal', 'github-hosted'],
  ['https://build.lan', 'github-hosted'],
  ['not a url', 'github-hosted'],
  ['ftp://api.example.com', 'github-hosted'],
  ['http://10.0.0.1:4000', 'private-network'],
  ['http://localhost:4000', 'private-network'],
  ['https://a:b@10.0.0.1', 'private-network'],
  ['ftp://10.0.0.1', 'private-network'],
];

/** The verdict as the generated job sees it: the script run on its own. */
function preflightVerdict(url: string, execution: Execution): string {
  try {
    runInNewContext(
      `const validate = ${CI_API_CONNECTIVITY_PREFLIGHT}; validate(url, execution);`,
      { URL, url, execution },
    );
    return 'allowed';
  } catch (error) {
    return `rejected: ${(error as Error).message}`;
  }
}

function apiVerdict(url: string, execution: Execution): string {
  try {
    validateCiApiConnectivity(url, execution);
    return 'allowed';
  } catch (error) {
    return `rejected: ${(error as Error).message}`;
  }
}

describe('CI API connectivity preflight', () => {
  it.each(REJECTED_FOR_GITHUB_HOSTED)(
    'rejects %s for GitHub-hosted jobs',
    (url) => {
      expect(() => validateCiApiConnectivity(url, 'github-hosted')).toThrow(
        'PLATFORM_PUBLIC_URL',
      );
    },
  );

  it('allows public HTTPS and explicit private execution', () => {
    expect(() =>
      validateCiApiConnectivity(
        'https://api.example.com/api/v1',
        'github-hosted',
      ),
    ).not.toThrow();
    expect(() =>
      validateCiApiConnectivity('http://10.0.0.1:4000', 'private-network'),
    ).not.toThrow();
  });

  it.each(CASES)(
    'the generated script and the API agree on %s (%s)',
    (url, execution) => {
      expect(preflightVerdict(url, execution)).toBe(apiVerdict(url, execution));
    },
  );
});
