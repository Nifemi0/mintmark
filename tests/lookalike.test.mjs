import test from 'node:test';
import assert from 'node:assert/strict';
import { findLookalikes, lookalikeVerdict, readTokenIdentity } from '../lookalike.mjs';

const records = [
  { key: '56:0xa', symbol: 'NVDAon', tokenName: 'NVIDIA (Ondo Tokenized)', underlyingTicker: 'NVDA', companyName: 'NVIDIA', providerName: 'Ondo', contractAddress: '0xa' },
  { key: '56:0xb', symbol: 'NVDAB', tokenName: 'NVIDIA Corp', underlyingTicker: 'NVDA', companyName: 'NVIDIA', providerName: 'bStocks', contractAddress: '0xb' },
  { key: '56:0xc', symbol: 'AAPLon', tokenName: 'Apple (Ondo Tokenized)', underlyingTicker: 'AAPL', companyName: 'Apple', providerName: 'Ondo', contractAddress: '0xc' },
];

test('a fake token copying a registered symbol is flagged as an impersonation risk', () => {
  const identity = { state: 'contract', symbol: 'NVDAon', name: 'NVIDIA Ondo' };
  const found = findLookalikes(records, identity);
  assert.deepEqual(found.map((item) => [item.symbol, item.reason]), [['NVDAon', 'same_symbol'], ['NVDAB', 'same_underlying']]);
  assert.equal(lookalikeVerdict(identity, found), 'impersonation_risk');
});

test('a token copying a registered name is flagged, matching case-insensitively', () => {
  const identity = { state: 'contract', symbol: 'XYZ', name: 'apple (ondo tokenized)' };
  const found = findLookalikes(records, identity);
  assert.deepEqual(found.map((item) => item.reason), ['same_name']);
  assert.equal(lookalikeVerdict(identity, found), 'impersonation_risk');
});

test('a token on the same underlying is related, an unrelated one is unknown', () => {
  const related = { state: 'contract', symbol: 'AAPLx', name: 'Apple xStock' };
  assert.equal(lookalikeVerdict(related, findLookalikes(records, related)), 'related_unregistered');
  const other = { state: 'contract', symbol: 'CAKE', name: 'PancakeSwap Token' };
  assert.deepEqual(findLookalikes(records, other), []);
  assert.equal(lookalikeVerdict(other, []), 'unknown');
  assert.equal(lookalikeVerdict({ state: 'no_contract' }, []), 'no_contract');
});

test('onchain identity reader decodes symbol and name and detects empty addresses', async () => {
  const abi = (text) => '0x' + '20'.padStart(64, '0') + Buffer.byteLength(text).toString(16).padStart(64, '0') + Buffer.from(text).toString('hex').padEnd(64, '0');
  const reply = (code) => async () => ({ ok: true, json: async () => [{ id: 1, result: code }, { id: 2, result: abi('NVDAon') }, { id: 3, result: abi('NVIDIA') }] });
  assert.deepEqual(await readTokenIdentity('0x' + '1'.repeat(40), reply('0x6080')), { state: 'contract', symbol: 'NVDAon', name: 'NVIDIA' });
  assert.deepEqual(await readTokenIdentity('0x' + '1'.repeat(40), reply('0x')), { state: 'no_contract' });
  await assert.rejects(readTokenIdentity('0x' + '1'.repeat(40), async () => ({ ok: false, status: 503 })), /503/);
});
