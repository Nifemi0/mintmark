// Binance Spot pair verification for registry records.
// A Spot route is shown only when a stored check found the exact
// SYMBOL/USDT pair listed with status TRADING.

export const SPOT_EXCHANGE_INFO_URL = 'https://data-api.binance.vision/api/v3/exchangeInfo';
export const SPOT_QUOTE = 'USDT';

export function buildSpotPairs(records, exchangeInfo, checkedAt) {
  if (!Array.isArray(exchangeInfo?.symbols)) throw new Error('exchangeInfo response has no symbols list');
  const bySymbol = new Map(exchangeInfo.symbols.map((item) => [item.symbol, item]));
  const pairs = {};
  const missing = [];
  for (const record of records) {
    if (record.platformId !== 'bstock') continue;
    const listing = bySymbol.get(`${record.symbol}${SPOT_QUOTE}`);
    if (listing && listing.baseAsset === record.symbol && listing.quoteAsset === SPOT_QUOTE && listing.status === 'TRADING') {
      pairs[record.key] = { pair: listing.symbol, baseAsset: listing.baseAsset, quoteAsset: listing.quoteAsset, status: listing.status };
    } else {
      missing.push({ key: record.key, symbol: record.symbol, status: listing?.status ?? 'not_listed' });
    }
  }
  return { checkedAt, sourceUrl: SPOT_EXCHANGE_INFO_URL, quote: SPOT_QUOTE, pairs, missing };
}

export function spotRouteFor(record, spot) {
  const pair = spot?.pairs?.[record.key];
  if (!pair) return null;
  return { ...pair, checkedAt: spot.checkedAt, sourceUrl: spot.sourceUrl };
}
