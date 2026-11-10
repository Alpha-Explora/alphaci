import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTE_CONTRACTS } from '../e2e/support/contracts/routes';

/*
 * A route whose response the web app reads declares its contract: the type in
 * packages/api-contracts, a schema in tests/e2e/support/contracts, and a line in
 * ROUTE_CONTRACTS. That is how a changed response reaches the web typecheck and
 * fails an e2e spec instead of a browser.
 *
 * This is a ratchet over the route inventory (route-inventory.baseline.txt,
 * which route-inventory.spec.ts keeps equal to the real routes). Every route is
 * either in ROUTE_CONTRACTS or listed in route-contracts.baseline.txt, the
 * routes that have none yet. A new route fails here until it declares one;
 * adding it to the baseline instead is possible, and shows in the diff.
 *
 * Declaring a contract for a baseline route: add it to ROUTE_CONTRACTS, then run
 * `UPDATE_ROUTE_CONTRACTS_BASELINE=1 npm test -w @alphaci/api -- route-contracts`.
 */

const lines = (path: string): string[] =>
  readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);

const INVENTORY = resolve(
  __dirname,
  '../../architecture/route-inventory.baseline.txt',
);
const BASELINE = resolve(__dirname, 'route-contracts.baseline.txt');

const inventory = lines(INVENTORY);
const declared = new Set<string>(Object.keys(ROUTE_CONTRACTS));
const undeclared = inventory.filter((route) => !declared.has(route));

if (process.env['UPDATE_ROUTE_CONTRACTS_BASELINE'] === '1') {
  writeFileSync(BASELINE, `${undeclared.join('\n')}\n`);
}
const baseline = new Set(lines(BASELINE));

describe('route contracts', () => {
  it('declares a contract for every route, or lists it as not yet declared', () => {
    expect(undeclared.filter((route) => !baseline.has(route))).toEqual([]);
  });

  it('keeps the baseline to routes that exist and still lack a contract', () => {
    expect(
      [...baseline].filter((route) => !undeclared.includes(route)),
    ).toEqual([]);
  });

  it('declares contracts only for routes that exist', () => {
    expect([...declared].filter((route) => !inventory.includes(route))).toEqual(
      [],
    );
  });
});
