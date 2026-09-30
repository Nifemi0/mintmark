import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRecords } from '../registry.mjs';
import { mapWalletHoldings } from '../wallet.mjs';
import { getKnownTokenBalances } from '../binance.mjs';

const snapshot = JSON.parse(await readFile(new URL('../data/ondo-bsc.json', import.meta.url), 'utf8'));
const records = normalizeRecords(snapshot.records);
const address = '0x73d8bd54f7cf5fab43fe4ef40a62d390644946db';

test('wallet holdings match exact chain and contract even when symbols coincide', () => {
  const token = records[0];
  const assets = [
    { binanceChainId: '56', tokenContractAddress: token.contractAddress, symbol: 'fake', balance: '1.25' },
    { binanceChainId: '56', tokenContractAddress: '0x' + '1'.repeat(40), symbol: token.symbol, balance: '7' },
    { binanceChainId: '1', tokenContractAddress: token.contractAddress, symbol: token.symbol, balance: '9' },
    { binanceChainId: '56', tokenContractAddress: token.contractAddress, symbol: token.symbol, balance: '0' },
  ];
  const result = mapWalletHoldings(address, assets, records, '2026-09-29T12:00:00.000Z');
  assert.equal(result.supported.length, 1);
  assert.equal(result.supported[0].key, token.key);
  assert.equal(result.supported[0].balance, '1.25');
  assert.equal(result.unsupported.length, 1);
  assert.equal(result.unsupported[0].reportedSymbol, token.symbol);
  assert.throws(() => mapWalletHoldings('bad address', assets, records, ''), /complete BSC/);
});

test('targeted wallet API signs POST bodies and queries each supported contract', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ code: 0, data: [{ tokenAssets: [{ binanceChainId: '56', tokenContractAddress: records[0].contractAddress, balance: '2' }] }] }) };
  };
  const checkedRecords = records.filter((record) => record.walletLookupEnabled);
  const result = await getKnownTokenBalances(address, checkedRecords.map((record) => record.contractAddress), { OC_API_KEY: 'test', OC_SECRET_KEY: 'test' }, fakeFetch);
  assert.equal(calls.length, 2);
  assert.equal(result.tokenAssets.length, 2);
  assert.ok(calls.every((call) => call.options.method === 'POST' && call.options.headers['X-OC-SIGN']));
  const queried = calls.flatMap((call) => JSON.parse(call.options.body).tokenContractAddresses.map((item) => item.tokenContractAddress));
  assert.deepEqual(queried, checkedRecords.map((record) => record.contractAddress));
});
