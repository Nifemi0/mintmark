import test from 'node:test';
import assert from 'node:assert/strict';
import { evolveRegistryHistory } from '../history.mjs';

const address = '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4';
const key = `56:${address}`;
const record = { key, chainId: '56', contractAddress: address, issuer: 'Ondo Finance', platformId: 'ondo', symbol: 'AAPLon', tokenName: 'Apple (Ondo Tokenized)', underlyingTicker: 'AAPL', companyName: 'Apple', assetType: 'Stock' };

test('registry history preserves prior versions and records actual field changes only', () => {
  const first = evolveRegistryHistory(null, [record], '2026-09-29T00:00:00Z', 'https://docs.ondo.finance/addresses');
  const repeat = evolveRegistryHistory(first, [record], '2026-09-30T00:00:00Z', 'https://docs.ondo.finance/addresses');
  assert.equal(repeat.records[key].entries.length, 1);
  const changed = evolveRegistryHistory(repeat, [{ ...record, companyName: 'Apple Inc.' }], '2026-10-01T00:00:00Z', 'https://docs.ondo.finance/addresses');
  assert.equal(changed.records[key].entries.length, 2);
  assert.deepEqual(changed.records[key].entries[1].changes, [{ field: 'companyName', from: 'Apple', to: 'Apple Inc.' }]);
  assert.equal(changed.records[key].entries[0].snapshot.companyName, 'Apple');
  assert.equal(changed.records[key].entries[1].version, 2);
});

test('a catalog removal is visible without claiming issuer retirement', () => {
  const first = evolveRegistryHistory(null, [record], '2026-09-29T00:00:00Z', 'https://docs.ondo.finance/addresses');
  const removed = evolveRegistryHistory(first, [], '2026-09-30T00:00:00Z', 'https://docs.ondo.finance/addresses');
  assert.equal(removed.records[key].entries[1].kind, 'removed_from_catalog');
  assert.match(removed.records[key].entries[1].reviewMethod, /does not prove/);
});
