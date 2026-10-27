const DEX_API = 'https://api.dexscreener.com/token-pairs/v1/bsc/';
const MIN_LIQUIDITY_USD = 25000;
const cache = new Map();

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getDexRoute(record) {
  const cached = cache.get(record.key);
  if (cached && Date.now() < cached.until) return cached.value;
  const promise = fetch(`${DEX_API}${record.contractAddress}`, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`DEX indexer returned ${response.status}`)))
    .then((payload) => {
      const pairs = Array.isArray(payload) ? payload : [];
      const eligible = pairs
        .filter((pair) => pair?.chainId === 'bsc')
        .filter((pair) => String(pair.baseToken?.address ?? '').toLowerCase() === record.contractAddress)
        .map((pair) => ({ ...pair, liquidityUsd: finiteNumber(pair.liquidity?.usd) }))
        .filter((pair) => pair.liquidityUsd != null && pair.liquidityUsd >= MIN_LIQUIDITY_USD)
        .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
      const pair = eligible[0];
      if (!pair) return { state: 'unavailable', checkedAt: new Date().toISOString(), detail: 'No BNB Chain pool with at least $25,000 indexed liquidity was found for this exact contract.' };
      return {
        state: 'detected', checkedAt: new Date().toISOString(),
        dexId: pair.dexId, pairAddress: pair.pairAddress, url: pair.url,
        tradeUrl: pair.dexId === 'pancakeswap'
          ? `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${record.contractAddress}`
          : pair.url,
        liquidityUsd: pair.liquidityUsd, priceUsd: finiteNumber(pair.priceUsd),
        quoteSymbol: pair.quoteToken?.symbol ?? null,
        detail: `Largest indexed ${pair.dexId} pool: ${pair.baseToken?.symbol ?? record.symbol}/${pair.quoteToken?.symbol ?? 'quote'} with $${Math.round(pair.liquidityUsd).toLocaleString()} liquidity.`,
      };
    })
    .catch((error) => ({ state: 'error', checkedAt: new Date().toISOString(), detail: `DEX liquidity check unavailable: ${error.message}` }));
  cache.set(record.key, { until: Date.now() + 60000, value: promise });
  return promise;
}
