import { createHmac } from 'node:crypto';

const RWA_LIST = '/api/v1/dex/market/rwa/tokens';
const RWA_PROFILE = '/api/v1/dex/market/rwa/underlying-profile';
const RWA_MARKET = '/api/v1/dex/market/rwa/underlying-market';
const CANDLES = '/api/v1/dex/market/candles';
const TOKEN_TRADING_INFO = '/api/v1/dex/market/price-info';
const TARGETED_BALANCES = '/api/v1/dex/balance/token-balances-by-address';

export function hasBinanceCredentials(env = process.env) {
  return Boolean(env.OC_API_KEY && env.OC_SECRET_KEY);
}

export function signedRequest(path, params = {}, env = process.env, timestamp = new Date().toISOString(), method = 'GET', body = '') {
  if (!hasBinanceCredentials(env)) throw new Error('Binance API credentials are missing');
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const fullPath = `/build${path}${query ? `?${query}` : ''}`;
  const preHash = `${timestamp}${method}${fullPath}${body}`;
  const signature = createHmac('sha256', env.OC_SECRET_KEY).update(preHash, 'utf8').digest('base64');
  return {
    url: `https://web3.binance.com${fullPath}`,
    headers: { 'X-OC-APIKEY': env.OC_API_KEY, 'X-OC-TIMESTAMP': timestamp, 'X-OC-SIGN': signature, 'X-OC-RECV-WINDOW': '60000' },
  };
}

export async function getBinanceData(path, params, env = process.env, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const request = signedRequest(path, params, env);
    const response = await fetchImpl(request.url, { headers: request.headers, signal: AbortSignal.timeout(12000) });
    const payload = await response.json();
    if (response.ok && payload.code === 0 && payload.success !== false && payload.data != null) {
      return { data: payload.data, observedAt: new Date().toISOString(), providerTimestamp: payload.timestamp ?? null };
    }
    if ((response.status === 429 || payload.code === 42900) && attempt < 2) {
      const seconds = Number(response.headers?.get?.('retry-after'));
      const delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : 1200 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(`Binance API failed (${response.status}, code ${payload.code ?? 'unknown'})`);
  }
}

export async function postBinanceData(path, payload, env = process.env, fetchImpl = fetch) {
  const body = JSON.stringify(payload);
  const request = signedRequest(path, {}, env, new Date().toISOString(), 'POST', body);
  const response = await fetchImpl(request.url, {
    method: 'POST', headers: { ...request.headers, 'content-type': 'application/json' },
    body, signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0 || result.success === false || result.data == null) {
    throw new Error(`Binance API failed (${response.status}, code ${result.code ?? 'unknown'})`);
  }
  return { data: result.data, observedAt: new Date().toISOString() };
}

export async function getRwaTokens(env = process.env, fetchImpl = fetch) {
  const result = await getBinanceData(RWA_LIST, { binanceChainId: '56' }, env, fetchImpl);
  if (!Array.isArray(result.data)) throw new Error('Binance RWA list returned an unexpected shape');
  return { rows: result.data, observedAt: result.observedAt };
}

export function getUnderlyingProfile(address, env = process.env, fetchImpl = fetch) {
  return getBinanceData(RWA_PROFILE, { binanceChainId: '56', tokenContractAddress: address }, env, fetchImpl);
}

export function getUnderlyingMarket(address, env = process.env, fetchImpl = fetch) {
  return getBinanceData(RWA_MARKET, { binanceChainId: '56', tokenContractAddress: address }, env, fetchImpl);
}

export function getTokenCandles(address, env = process.env, fetchImpl = fetch) {
  return getBinanceData(CANDLES, { binanceChainId: '56', tokenContractAddress: address, bar: '1d', limit: '30' }, env, fetchImpl);
}

export function getTokenTradingInfo(address, env = process.env, fetchImpl = fetch) {
  return postBinanceData(TOKEN_TRADING_INFO, [{ binanceChainId: '56', tokenContractAddress: address }], env, fetchImpl);
}

export async function getKnownTokenBalances(address, contracts, env = process.env, fetchImpl = fetch) {
  if (!Array.isArray(contracts)) throw new TypeError('Contracts must be an array');
  const tokenAssets = [];
  let observedAt = null;
  for (let offset = 0; offset < contracts.length; offset += 20) {
    const requestContracts = contracts.slice(offset, offset + 20).map((tokenContractAddress) => ({
      binanceChainId: '56', tokenContractAddress,
    }));
    const result = await postBinanceData(TARGETED_BALANCES, {
      address, tokenContractAddresses: requestContracts, excludeRiskToken: '0',
    }, env, fetchImpl);
    if (!Array.isArray(result.data)) throw new Error('Binance targeted balances returned an unexpected shape');
    tokenAssets.push(...result.data.flatMap((chain) => Array.isArray(chain.tokenAssets) ? chain.tokenAssets : []));
    observedAt = result.observedAt;
  }
  return { tokenAssets, observedAt, partial: false };
}
