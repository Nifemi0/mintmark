// bStocks are published only through Binance's signed RWA API, and Binance
// refuses requests from US hosts (code 40304). Mintmark's production server runs
// in Cape Town with the credentials, so it relays the bStocks rows at
// /api/sync/bstocks; the daily job and syncs elsewhere read them from there.
import { getRwaTokens, hasBinanceCredentials } from './binance.mjs';

export const BSTOCK_RELAY_URL = process.env.BSTOCK_RELAY_URL || 'https://mintmark.nuvixes.studio/api/sync/bstocks';
const FIELDS = ['binanceChainId', 'tokenContractAddress', 'tokenSymbol', 'tokenName', 'underlyingTicker', 'underlyingName', 'tokenLogoUrl', 'platformId'];

export function bstockRowsOnly(rows) {
  return rows
    .filter((row) => row.platformId === 'bstock' && String(row.binanceChainId) === '56')
    .map((row) => Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null])));
}

async function viaRelay(fetchImpl) {
  const response = await fetchImpl(BSTOCK_RELAY_URL, { signal: AbortSignal.timeout(30000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`bStocks relay returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) throw new Error('bStocks relay returned no rows');
  return { rows: bstockRowsOnly(payload.rows), observedAt: payload.observedAt, via: 'relay' };
}

// Direct Binance call when this host may use it, else the production relay.
export async function getBstockRows({ env = process.env, fetchImpl = fetch } = {}) {
  const errors = [];
  if (hasBinanceCredentials(env)) {
    try {
      const { rows, observedAt } = await getRwaTokens(env, fetchImpl);
      return { rows: bstockRowsOnly(rows), observedAt, via: 'binance' };
    } catch (error) {
      errors.push(`direct: ${error.message}`);
    }
  }
  try {
    return await viaRelay(fetchImpl);
  } catch (error) {
    errors.push(`relay: ${error.message}`);
  }
  throw new Error(`bStocks rows unavailable (${errors.join('; ')})`);
}
