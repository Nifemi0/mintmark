import test from 'node:test';
import assert from 'node:assert/strict';
import { getDexRoute } from '../dex.mjs';

const address = '0xa9ee28c80f960b889dfbd1902055218cba016f75';
const other = '0x02fca66c1d1afb4e2a7884261eb00f63598a7436';
let keySeq = 0;
// getDexRoute caches by record key for 60 seconds, so each test uses a fresh key.
const record = () => ({ key: `56:${address}:t${keySeq++}`, contractAddress: address, symbol: 'NVDAon' });

function pair(overrides = {}) {
  return {
    chainId: 'bsc', dexId: 'pancakeswap', pairAddress: '0xpair', url: 'https://dexscreener.com/bsc/0xpair',
    priceUsd: '180.5', baseToken: { address, symbol: 'NVDAon' }, quoteToken: { symbol: 'USDT' },
    liquidity: { usd: 50000 }, ...overrides,
  };
}

async function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

const respond = (payload, ok = true, status = 200) => async () => ({ ok, status, json: async () => payload });

test('DEX route picks the deepest eligible pool for the exact BSC contract', async () => {
  const pairs = [
    pair({ pairAddress: '0xsmall', liquidity: { usd: 30000 } }),
    pair({ pairAddress: '0xdeep', liquidity: { usd: 90000 } }),
    pair({ pairAddress: '0xotherchain', chainId: 'ethereum', liquidity: { usd: 900000 } }),
    pair({ pairAddress: '0xothertoken', baseToken: { address: other, symbol: 'NVDAB' }, liquidity: { usd: 900000 } }),
  ];
  const route = await withFetch(respond(pairs), () => getDexRoute(record()));
  assert.equal(route.state, 'detected');
  assert.equal(route.pairAddress, '0xdeep');
  assert.equal(route.liquidityUsd, 90000);
  assert.equal(route.priceUsd, 180.5);
  assert.equal(route.quoteSymbol, 'USDT');
  assert.equal(route.tradeUrl, `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${address}`);
});

test('DEX route matches the base token address case-insensitively', async () => {
  const route = await withFetch(respond([pair({ baseToken: { address: address.toUpperCase().replace('0X', '0x'), symbol: 'NVDAon' } })]),
    () => getDexRoute(record()));
  assert.equal(route.state, 'detected');
});

test('DEX route links non-PancakeSwap pools to the indexer page', async () => {
  const route = await withFetch(respond([pair({ dexId: 'uniswap' })]), () => getDexRoute(record()));
  assert.equal(route.state, 'detected');
  assert.equal(route.tradeUrl, 'https://dexscreener.com/bsc/0xpair');
});

test('DEX route is unavailable below the liquidity threshold or with missing liquidity', async () => {
  const pairs = [pair({ liquidity: { usd: 24999 } }), pair({ liquidity: {} }), pair({ liquidity: { usd: 'n/a' } })];
  const route = await withFetch(respond(pairs), () => getDexRoute(record()));
  assert.equal(route.state, 'unavailable');
  assert.match(route.detail, /\$25,000/);
});

test('DEX route treats a non-array payload as no pools', async () => {
  const route = await withFetch(respond({ pairs: null }), () => getDexRoute(record()));
  assert.equal(route.state, 'unavailable');
});

test('DEX route reports an indexer failure as an error state', async () => {
  const route = await withFetch(respond(null, false, 503), () => getDexRoute(record()));
  assert.equal(route.state, 'error');
  assert.match(route.detail, /503/);
});

test('DEX route caches the result per record', async () => {
  let calls = 0;
  const rec = record();
  const fetchImpl = async () => { calls++; return { ok: true, status: 200, json: async () => [pair()] }; };
  await withFetch(fetchImpl, async () => {
    const first = await getDexRoute(rec);
    const second = await getDexRoute(rec);
    assert.equal(first, second);
  });
  assert.equal(calls, 1);
});
