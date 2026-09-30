import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompanyReport, normalizeCandles } from '../report.mjs';

const address = '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4';
const record = { key: `56:${address}`, contractAddress: address, platformId: 'ondo', underlyingTicker: 'AAPL', companyName: 'Apple' };
const identity = { binanceChainId: '56', tokenContractAddress: address, platformId: 'ondo' };

test('company report separates underlying market figures from token candle movement', () => {
  const report = buildCompanyReport(record,
    { data: { ...identity, underlyingTicker: 'AAPL', companyInfo: { industry: 'Technology', description: 'Device maker.' } }, observedAt: '2026-09-29T12:00:00Z' },
    { data: { ...identity, marketData: { referencePrice: '330.05', marketCap: '4000000000000', dividendYield: null } }, observedAt: '2026-09-29T12:01:00Z' },
    { data: [[110, 110, 90, 100, 1, 1000, 1], [120, 125, 110, 120, 1, 2000, 1]], observedAt: '2026-09-29T12:02:00Z' },
  );
  assert.equal(report.company.industry, 'Technology');
  assert.equal(report.underlyingMarket.referencePrice, '330.05');
  assert.equal(report.underlyingMarket.dividendYield, null);
  assert.ok(Math.abs(report.tokenMovement.changePct - 20) < 1e-9);
  assert.match(report.tokenMovement.description, /not a historical quote/);
});

test('report rejects market data for another contract or ticker', () => {
  const profile = { data: { ...identity, underlyingTicker: 'AAPL' }, observedAt: 'now' };
  const market = { data: { ...identity, marketData: {} }, observedAt: 'now' };
  const candles = { data: [], observedAt: 'now' };
  assert.throws(() => buildCompanyReport(record, profile, { ...market, data: { ...market.data, tokenContractAddress: '0x2494b603319d4d9f9715c9f4496d9e0364b59d93' } }, candles), /exact registry contract/);
  assert.throws(() => buildCompanyReport(record, { ...profile, data: { ...profile.data, underlyingTicker: 'TSLA' } }, market, candles), /ticker conflicts/);
});

test('candles sort by time and discard malformed prices', () => {
  assert.deepEqual(normalizeCandles([[0, 0, 0, 120, 1, 2000, 1], [0, 0, 0, -1, 1, 1500, 1], [0, 0, 0, 100, 1, 1000, 1]]), [
    { close: 100, timestamp: 1000 }, { close: 120, timestamp: 2000 },
  ]);
});
