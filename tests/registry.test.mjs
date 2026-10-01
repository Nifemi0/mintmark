import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAddress, identityKey, normalizeRecords, searchRecords, classifyEvidence, crossCheckBinance } from '../registry.mjs';
import { signedRequest, getRwaTokens, getTokenTradingInfo } from '../binance.mjs';
import { parseCsv, decodeAbiString } from '../scripts/sync-ondo.mjs';

const address = '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4';
const base = { chainId: '56', contractAddress: address, symbol: 'AAPLon', tokenName: 'Apple (Ondo Tokenized)', underlyingTicker: 'AAPL', companyName: 'Apple', issuer: 'Ondo Finance', platformId: 'ondo' };

test('identity is BSC chain plus exact 40-byte contract, never the ticker', () => {
  assert.equal(identityKey('56', address.toUpperCase().replace('0X', '0x')), `56:${address}`);
  assert.equal(identityKey('1', address), null);
  assert.equal(normalizeAddress('0x123'), null);
});

test('duplicate contracts and non-BSC records are rejected', () => {
  assert.throws(() => normalizeRecords([base, { ...base, symbol: 'FAKE' }]), /Duplicate identity/);
  assert.throws(() => normalizeRecords([{ ...base, chainId: '1' }]), /Invalid BSC contract/);
  assert.throws(() => normalizeRecords([{ ...base, platformId: null }]), /Missing required identity field/);
});

test('ticker search can find a company, but contract search only matches the exact address', () => {
  const records = normalizeRecords([base]);
  assert.equal(searchRecords(records, 'aapl').length, 1);
  assert.equal(searchRecords(records, address.toUpperCase().replace('0X', '0x')).length, 1);
  assert.equal(searchRecords(records, '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c5').length, 0);
  assert.equal(searchRecords(records, '0x390a').length, 0);
});

test('discovery search finds a company through its area or plain-language keyword', () => {
  const records = normalizeRecords([{ ...base, category: 'Technology', keywords: ['devices', 'phones'] }]);
  assert.equal(searchRecords(records, 'technology').length, 1);
  assert.equal(searchRecords(records, 'phones').length, 1);
  assert.equal(searchRecords(records, 'apple').length, 1);
  assert.equal(searchRecords(records, 'healthcare').length, 0);
});

test('evidence classification rejects invented confidence labels', () => {
  assert.equal(classifyEvidence('onchain_observed'), 'onchain_observed');
  assert.equal(classifyEvidence('unverified'), 'unverified');
  assert.throws(() => classifyEvidence('fully_verified'), /Unsupported evidence class/);
});

test('Binance cross-check requires complete exact identity and surfaces conflicts', () => {
  const records = normalizeRecords([base]);
  const row = { binanceChainId: '56', tokenContractAddress: address, underlyingTicker: 'AAPL', platformId: 'ondo', tokenSymbol: 'AAPLon', tokenName: 'Apple (Ondo Tokenized)' };
  assert.equal(crossCheckBinance(records, [row])[0].binanceCheck.state, 'matched');
  assert.equal(crossCheckBinance(records, [{ ...row, platformId: 'bstock' }])[0].binanceCheck.state, 'conflict');
  assert.equal(crossCheckBinance(records, [{ ...row, tokenSymbol: 'FAKE' }])[0].binanceCheck.state, 'conflict');
  assert.equal(crossCheckBinance(records, [{ ...row, tokenName: 'Apple (Ondo)' }])[0].binanceCheck.state, 'name_difference');
  assert.equal(crossCheckBinance(records, [{ ...row, tokenName: null }])[0].binanceCheck.state, 'incomplete');
  assert.equal(crossCheckBinance(records, [row, row])[0].binanceCheck.state, 'conflict');
  assert.equal(crossCheckBinance(records, [{ ...row, binanceChainId: '1' }])[0].binanceCheck.state, 'not_found');
  assert.equal(crossCheckBinance(records, [])[0].binanceCheck.state, 'not_found');
});

test('Binance signature includes the /build prefix and exact raw query', () => {
  const env = { OC_API_KEY: 'test-key', OC_SECRET_KEY: 'test-secret' };
  const request = signedRequest('/api/v1/dex/market/rwa/tokens', { binanceChainId: '56' }, env, '2026-09-29T00:00:00.000Z');
  assert.equal(request.url, 'https://web3.binance.com/build/api/v1/dex/market/rwa/tokens?binanceChainId=56');
  assert.equal(request.headers['X-OC-SIGN'], 'TwaIMHssm39uZAKFBTqR3Yj6OOlbNUQqH335HfTI3j4=');
});

test('Binance adapter handles a successful RWA list response without exposing the secret', async () => {
  const env = { OC_API_KEY: 'public-test-key', OC_SECRET_KEY: 'private-test-secret' };
  const fakeFetch = async (url, options) => {
    assert.match(url, /binanceChainId=56/);
    assert.equal(options.headers['X-OC-APIKEY'], 'public-test-key');
    assert.ok(options.headers['X-OC-SIGN']);
    assert.ok(!JSON.stringify(options).includes('private-test-secret'));
    return { ok: true, status: 200, json: async () => ({ code: 0, data: [{ binanceChainId: '56', tokenContractAddress: address, platformId: 'ondo', underlyingTicker: 'AAPL', tokenName: 'Apple (Ondo Tokenized)', tokenSymbol: 'AAPLon' }] }) };
  };
  const result = await getRwaTokens(env, fakeFetch);
  assert.equal(result.rows.length, 1);
  assert.ok(result.observedAt);
});

test('Binance adapter retries a temporary rate limit and returns the verified response', async () => {
  const env = { OC_API_KEY: 'public-test-key', OC_SECRET_KEY: 'private-test-secret' };
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, headers: { get: () => '0.001' }, json: async () => ({ code: 42900 }) };
    return { ok: true, status: 200, json: async () => ({ code: 0, data: [] }) };
  };
  const result = await getRwaTokens(env, fakeFetch);
  assert.equal(calls, 2);
  assert.deepEqual(result.rows, []);
});

test('Binance market adapter requests the exact BSC contract in a signed POST body', async () => {
  const env = { OC_API_KEY: 'public-test-key', OC_SECRET_KEY: 'private-test-secret' };
  const fakeFetch = async (url, options) => {
    assert.equal(url, 'https://web3.binance.com/build/api/v1/dex/market/price-info');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['content-type'], 'application/json');
    assert.ok(options.headers['X-OC-SIGN']);
    assert.deepEqual(JSON.parse(options.body), [{ binanceChainId: '56', tokenContractAddress: address }]);
    return { ok: true, status: 200, json: async () => ({ code: 0, data: [{ binanceChainId: '56', tokenContractAddress: address, price: '232.10' }] }) };
  };
  const result = await getTokenTradingInfo(address, env, fakeFetch);
  assert.equal(result.data[0].price, '232.10');
  assert.ok(result.observedAt);
});

test('Ondo CSV parser preserves quoted commas and newlines', () => {
  const rows = parseCsv('Name,Description\nToken,"issuer, product\nwith a second line"\n');
  assert.deepEqual(rows, [{ Name: 'Token', Description: 'issuer, product\nwith a second line' }]);
});

test('ABI decoder reads an ERC-20 dynamic string', () => {
  const encoded = `0x${'0'.repeat(62)}20${'0'.repeat(62)}04${Buffer.from('TEST').toString('hex')}${'0'.repeat(56)}`;
  assert.equal(decodeAbiString(encoded), 'TEST');
});
