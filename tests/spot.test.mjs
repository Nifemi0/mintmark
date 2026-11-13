import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpotPairs, spotRouteFor } from '../spot.mjs';

const records = [
  { key: '56:0x02fca66c1d1afb4e2a7884261eb00f63598a7436', platformId: 'bstock', symbol: 'NVDAB' },
  { key: '56:0x1111111111111111111111111111111111111111', platformId: 'bstock', symbol: 'TSLAB' },
  { key: '56:0x2222222222222222222222222222222222222222', platformId: 'bstock', symbol: 'AMZNB' },
  { key: '56:0x3333333333333333333333333333333333333333', platformId: 'bstock', symbol: 'MSFTB' },
  { key: '56:0xa9ee28c80f960b889dfbd1902055218cba016f75', platformId: 'ondo', symbol: 'NVDAON' },
];
const exchangeInfo = { symbols: [
  { symbol: 'NVDABUSDT', baseAsset: 'NVDAB', quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'TSLABUSDT', baseAsset: 'TSLAB', quoteAsset: 'USDT', status: 'BREAK' },
  { symbol: 'NVDAONUSDT', baseAsset: 'NVDAON', quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'MSFTBUSDT', baseAsset: 'OTHER', quoteAsset: 'USDT', status: 'TRADING' },
] };

test('Spot check verifies only trading bStocks pairs with the exact base and quote', () => {
  const result = buildSpotPairs(records, exchangeInfo, '2026-11-13T00:00:00.000Z');
  assert.deepEqual(Object.keys(result.pairs), [records[0].key]);
  assert.equal(result.pairs[records[0].key].pair, 'NVDABUSDT');
  assert.deepEqual(result.missing.map((item) => [item.symbol, item.status]), [['TSLAB', 'BREAK'], ['AMZNB', 'not_listed'], ['MSFTB', 'TRADING']]);
  assert.ok(!(records[4].key in result.pairs), 'non-bStocks records are never given a Spot route');
});

test('Spot route carries the check time and source, or is null without a verified pair', () => {
  const spot = buildSpotPairs(records, exchangeInfo, '2026-11-13T00:00:00.000Z');
  const route = spotRouteFor(records[0], spot);
  assert.equal(route.checkedAt, '2026-11-13T00:00:00.000Z');
  assert.match(route.sourceUrl, /exchangeInfo$/);
  assert.equal(spotRouteFor(records[1], spot), null);
  assert.equal(spotRouteFor(records[0], null), null);
});

test('Spot check rejects a malformed exchangeInfo response', () => {
  assert.throws(() => buildSpotPairs(records, {}, 'now'), /no symbols list/);
});
