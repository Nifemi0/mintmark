import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { normalizeRecords } from '../registry.mjs';

const root = new URL('../', import.meta.url);
const snapshot = JSON.parse(await readFile(new URL('data/catalog.json', root), 'utf8'));
const history = JSON.parse(await readFile(new URL('data/registry-history.json', root), 'utf8'));

test('combined catalog has distinct checked identities from all three providers', async () => {
  const records = normalizeRecords(snapshot.records);
  assert.ok(records.length > 1000);
  for (const provider of ['ondo', 'bstock', 'xstock']) {
    assert.ok(records.some((record) => record.platformId === provider));
    assert.equal(records.filter((record) => record.platformId === provider).length, snapshot.source.providers[provider].count);
  }
  assert.equal(new Set(records.map((record) => record.key)).size, records.length);
  assert.ok(Object.keys(history.records).length >= records.length);
  for (const record of records) {
    assert.ok(history.records[record.key]);
    assert.match(record.logoUrl, /^https:\/\//);
    if (record.platformId === 'ondo') assert.ok((await stat(new URL(`public/logos/${record.underlyingTicker}.png`, root))).size > 100);
    assert.ok(record.evidence.some((item) => item.kind === 'onchain_observed' && item.field === 'tokenName'));
  }
  for (const [ticker, expectedProviders] of [
    ['NVDA', ['ondo', 'bstock', 'xstock']],
    ['TSLA', ['ondo', 'bstock', 'xstock']],
    ['AAPL', ['ondo', 'xstock']],
  ]) {
    const products = records.filter((record) => record.underlyingTicker === ticker);
    assert.deepEqual(products.map((record) => record.platformId), expectedProviders);
    assert.equal(new Set(products.map((record) => record.contractAddress)).size, products.length);
    for (const product of products) assert.match(product.issuerTermsUrl, /^https:\/\//);
  }
});

test('wallet lookup remains explicitly limited to its checked subset', () => {
  assert.equal(snapshot.records.filter((record) => record.walletLookupEnabled).length, 24);
});
