// Mintmark public API, version 1.
// Stable response shapes for integrators: fields may be added, never renamed or removed within v1.

export const API_VERSION = '1';
export const SITE_URL = 'https://mintmark.nuvixes.studio';
export const MAX_LOOKUP = 100;
const PROVIDER_NAMES = { ondo: 'Ondo', bstock: 'bStocks', xstock: 'xStocks' };
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function parseChainId(value) {
  const text = String(value ?? '').trim();
  if (text !== '56') throw new ApiError(400, 'unsupported_chain', 'Only BNB Smart Chain (chain ID 56) is covered in v1.');
  return 56;
}

export function parseAddress(value) {
  const text = String(value ?? '').trim();
  if (!ADDRESS.test(text)) throw new ApiError(400, 'invalid_address', 'Use a complete 0x contract address (40 hex characters).');
  return text.toLowerCase();
}

// The one token shape every v1 endpoint returns.
export function tokenView(record) {
  const status = record.tradingStatus ?? null;
  return {
    id: record.key,
    chainId: 56,
    address: record.contractAddress,
    symbol: record.symbol,
    name: record.tokenName,
    provider: {
      id: record.platformId,
      name: record.providerName ?? PROVIDER_NAMES[record.platformId] ?? record.platformId,
      issuer: record.issuer,
      publishedName: record.issuerTokenName ?? null,
    },
    underlying: { ticker: record.underlyingTicker, name: record.companyName, assetType: record.assetType ?? null },
    tradingStatus: status ? { halted: Boolean(status.halted), checkedAt: status.observedAt, source: status.source } : null,
    venues: { binanceSpotPair: record.binanceSpot?.pair ?? null },
    sourceNameDifference: record.sourceConflict ?? null,
    links: {
      record: `${SITE_URL}/registry?q=${encodeURIComponent(record.contractAddress)}#registry`,
      explorer: record.explorerUrl ?? `https://bscscan.com/token/${record.contractAddress}`,
      issuerTerms: record.issuerTermsUrl ?? null,
      source: record.publisherUrl ?? null,
    },
    observedAt: record.observedAt ?? null,
    recordVersion: record.recordVersion ?? null,
  };
}

// Exact-contract lookup for many addresses at once. Never reads the chain, so
// it stays fast and cheap; /v1/check does the onchain read for one address.
export function lookupTokens(addresses, records, observation) {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new ApiError(400, 'invalid_body', 'Send {"addresses": ["0x…", …]} with at least one address.');
  if (addresses.length > MAX_LOOKUP) throw new ApiError(400, 'too_many_addresses', `Send at most ${MAX_LOOKUP} addresses per request.`);
  const byAddress = new Map(records.map((record) => [record.contractAddress, record]));
  return addresses.map((value) => {
    const text = String(value ?? '').trim();
    if (!ADDRESS.test(text)) return { address: text, status: 'invalid_address', token: null };
    const address = text.toLowerCase();
    const record = byAddress.get(address);
    if (record) return { address, status: 'registered', token: tokenView(record) };
    const pending = pendingProvider(address, observation);
    if (pending) return { address, status: 'pending_review', token: null, published: pending };
    return { address, status: 'not_registered', token: null };
  });
}

export function pendingProvider(address, observation) {
  for (const provider of ['ondo', 'bstock', 'xstock']) {
    const published = observation?.[provider]?.[address];
    if (published) {
      return { provider: PROVIDER_NAMES[provider], symbol: published.symbol, name: published.name, ticker: published.ticker, observedAt: observation.observedAt };
    }
  }
  return null;
}

export function searchView(records, { q = '', provider = '', limit = '50', offset = '0' } = {}, search) {
  if (provider && !PROVIDER_NAMES[provider]) throw new ApiError(400, 'invalid_provider', 'provider must be ondo, bstock, or xstock.');
  const size = Number.parseInt(limit, 10);
  const start = Number.parseInt(offset, 10);
  if (!Number.isInteger(size) || size < 1 || size > 250) throw new ApiError(400, 'invalid_limit', 'limit must be between 1 and 250.');
  if (!Number.isInteger(start) || start < 0) throw new ApiError(400, 'invalid_offset', 'offset must be 0 or more.');
  if (String(q).length > 120) throw new ApiError(400, 'query_too_long', 'q must be 120 characters or fewer.');
  const matched = search(records, q).filter((record) => !provider || record.platformId === provider);
  const page = matched.slice(start, start + size);
  return { tokens: page.map(tokenView), total: matched.length, offset: start, limit: size, nextOffset: start + page.length < matched.length ? start + page.length : null };
}

export function companyView(records, ticker) {
  const wanted = String(ticker ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,15}$/.test(wanted)) throw new ApiError(400, 'invalid_ticker', 'Use a stock ticker such as NVDA.');
  const products = records.filter((record) => record.underlyingTicker === wanted);
  if (!products.length) throw new ApiError(404, 'company_not_found', `No registry products for ${wanted}.`);
  return { ticker: wanted, name: products[0].companyName, products: products.map(tokenView) };
}

// Best-effort per-instance rate limit. A Vercel firewall rule is the durable limit;
// this keeps a single runaway client from monopolising one function instance.
export function createRateLimiter({ limit = 120, windowMs = 60000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return (key) => {
    const time = now();
    let entry = hits.get(key);
    if (!entry || time >= entry.reset) {
      entry = { count: 0, reset: time + windowMs };
      hits.set(key, entry);
      if (hits.size > 5000) for (const [k, v] of hits) if (time >= v.reset) hits.delete(k);
    }
    entry.count += 1;
    return { allowed: entry.count <= limit, limit, remaining: Math.max(0, limit - entry.count), reset: Math.ceil(entry.reset / 1000) };
  };
}
