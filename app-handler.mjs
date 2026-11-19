import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { crossCheckBinance, normalizeAddress, normalizeRecords, searchRecords, classifyEvidence } from './registry.mjs';
import { getRwaTokens, getUnderlyingProfile, getUnderlyingMarket, getTokenCandles, getTokenTradingInfo, getKnownTokenBalances, hasBinanceCredentials } from './binance.mjs';
import { buildCompanyReport, buildTokenMarketCoverage } from './report.mjs';
import { mapWalletHoldings, walletLookupRecords } from './wallet.mjs';
import { getDexRoute } from './dex.mjs';
import { spotRouteFor } from './spot.mjs';
import { isReportDate, renderRss } from './daily-report.mjs';
import { readTokenIdentity, findLookalikes, lookalikeVerdict } from './lookalike.mjs';
import { exportRows, toCsv } from './catalog-export.mjs';
import { API_VERSION, ApiError, MAX_LOOKUP, parseChainId, parseAddress, tokenView, lookupTokens, pendingProvider, searchView, companyView, createRateLimiter } from './api-v1.mjs';
const contractCheckCache = new Map();

const root = path.dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'catalog.json'), 'utf8'));
const history = JSON.parse(await readFile(path.join(root, 'data', 'registry-history.json'), 'utf8'));
const spotPath = path.join(root, 'data', 'binance-spot.json');
const spotCheck = existsSync(spotPath) ? JSON.parse(await readFile(spotPath, 'utf8')) : null;
// The daily report's latest provider observation is fresher than the reviewed
// catalog, so xStocks halt status comes from it when it covers the contract.
const observationPath = path.join(root, 'data', 'state', 'report-observation.json');
const latestObservation = existsSync(observationPath) ? JSON.parse(await readFile(observationPath, 'utf8')).observation : null;

export function tradingStatusFor(record, observation) {
  if (record.platformId !== 'xstock') return null;
  const observed = observation?.xstock?.[record.contractAddress];
  if (observed) return { halted: Boolean(observed.halted), observedAt: observation.observedAt, source: 'xStocks asset API (daily report)' };
  return { halted: Boolean(record.tradingHalted), observedAt: record.observedAt, source: 'xStocks asset API (registry snapshot)' };
}

const baseRecords = normalizeRecords(snapshot.records).map((record) => ({
  ...record, binanceSpot: spotRouteFor(record, spotCheck),
  tradingStatus: tradingStatusFor({ ...record, contractAddress: record.contractAddress.toLowerCase() }, latestObservation),
}));
for (const record of baseRecords) for (const evidence of record.evidence) classifyEvidence(evidence.kind);

const reportsDir = path.join(root, 'data', 'reports');
const siteUrl = 'https://mintmark.nuvixes.studio';
async function readReportFile(name) {
  const file = path.join(reportsDir, name);
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : null;
}

let binanceCache = { until: 0, result: null, promise: null };
const reportCache = new Map();
const walletCache = new Map();

async function currentReport(record) {
  const cached = reportCache.get(record.key);
  if (cached && Date.now() < cached.until) return cached.promise;
  const identityOnly = (tokenMarket = { availability: 'unavailable', notes: ['Live exact-contract market data requires Binance API credentials.'] }) => ({
    key: record.key,
    availability: 'identity_only',
    tokenMarket,
    company: { name: record.companyName, ticker: record.underlyingTicker, industry: null, description: null, website: null, ceo: null, sourceKind: 'issuer_published', sourceUrl: record.publisherUrl, retrievedAt: record.observedAt },
    underlyingMarket: { referencePrice: null, marketCap: null, high52W: null, low52W: null, volumeShares24H: null, peRatioTTM: null, pbRatio: null, dividendYield: null, latestDividend: null, marketStatus: record.tradingHalted ? 'Trading halted' : null, sourceKind: 'issuer_published', sourceUrl: record.publisherUrl, retrievedAt: record.observedAt },
    tokenMovement: { points: [], firstClose: null, lastClose: null, changePct: null, firstAt: null, lastAt: null, sourceKind: 'issuer_published', sourceUrl: record.publisherUrl, retrievedAt: record.observedAt, description: 'A contract-verified xStock. Mintmark has no independently checked price series for this token.' },
  });
  const promise = record.platformId === 'xstock'
    ? hasBinanceCredentials()
      ? getTokenTradingInfo(record.contractAddress).then((trading) => identityOnly(buildTokenMarketCoverage(record, trading)))
      : Promise.resolve(identityOnly())
    : (async () => {
      const [profile, market, candles, trading] = await Promise.all([
        getUnderlyingProfile(record.contractAddress), getUnderlyingMarket(record.contractAddress),
        getTokenCandles(record.contractAddress), getTokenTradingInfo(record.contractAddress),
      ]);
      return buildCompanyReport(record, profile, market, candles, trading);
    })();
  reportCache.set(record.key, { until: Date.now() + 300000, promise });
  promise.catch(() => reportCache.delete(record.key));
  return promise;
}

async function currentWallet(address) {
  const cached = walletCache.get(address);
  if (cached && Date.now() < cached.until) return cached.promise;
  const promise = getKnownTokenBalances(address, walletLookupRecords(baseRecords).map((record) => record.contractAddress)).then((result) =>
    mapWalletHoldings(address, result.tokenAssets, baseRecords, result.observedAt, result.partial));
  walletCache.set(address, { until: Date.now() + 60000, promise });
  promise.catch(() => walletCache.delete(address));
  return promise;
}
async function currentRecords() {
  if (!hasBinanceCredentials()) {
    return { records: baseRecords, binance: { state: 'not_configured', detail: 'Binance API credentials have not been configured.' } };
  }
  if (Date.now() < binanceCache.until && binanceCache.result) return binanceCache.result;
  if (!binanceCache.promise) {
    binanceCache.promise = getRwaTokens().then(({ rows, observedAt }) => ({
      records: crossCheckBinance(baseRecords.filter((record) => record.platformId === 'ondo'), rows, observedAt)
        .concat(baseRecords.filter((record) => record.platformId !== 'ondo')),
      binance: { state: 'checked', observedAt, detail: 'Compared against the Binance RWA token list.' },
    })).catch((error) => ({
      records: baseRecords,
      binance: { state: 'error', detail: error.message },
    })).then((result) => {
      binanceCache.result = result;
      binanceCache.until = Date.now() + (result.binance.state === 'checked' ? 300000 : 30000);
      binanceCache.promise = null;
      return result;
    });
  }
  return binanceCache.promise;
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
}

function directoryRecord(record) {
  const evidence = record.evidence ?? [];
  return {
    key: record.key, contractAddress: record.contractAddress, companyName: record.companyName,
    underlyingTicker: record.underlyingTicker, symbol: record.symbol, issuer: record.issuer,
    category: record.category, featured: record.featured, platformId: record.platformId,
    providerName: record.providerName ?? record.issuer, logoUrl: record.logoUrl,
    issuerTermsUrl: record.issuerTermsUrl,
    onchainIdentityObserved: ['chainId', 'symbol', 'tokenName'].every((field) => evidence.some((item) => item.kind === 'onchain_observed' && item.field === field)),
    sourceRecordAvailable: evidence.some((item) => item.field === 'contractAddress' && ['issuer_published', 'third_party_reported'].includes(item.kind)),
    binanceState: record.binanceCheck?.state ?? (record.platformId === 'bstock' ? 'snapshot_source' : 'not_checked'),
    walletLookupEnabled: Boolean(record.walletLookupEnabled) || record.platformId === 'bstock',
    binanceSpot: record.binanceSpot ?? null,
    tradingStatus: record.tradingStatus ?? null,
    sourceConflict: record.sourceConflict,
  };
}

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/registry', ['registry.html', 'text/html; charset=utf-8']],
  ['/registry/', ['registry.html', 'text/html; charset=utf-8']],
  ['/wallet', ['wallet.html', 'text/html; charset=utf-8']],
  ['/wallet/', ['wallet.html', 'text/html; charset=utf-8']],
  ['/method', ['method.html', 'text/html; charset=utf-8']],
  ['/method/', ['method.html', 'text/html; charset=utf-8']],
  ['/docs', ['docs.html', 'text/html; charset=utf-8']],
  ['/docs/', ['docs.html', 'text/html; charset=utf-8']],
  ['/reports', ['reports.html', 'text/html; charset=utf-8']],
  ['/reports/', ['reports.html', 'text/html; charset=utf-8']],
  ['/reports.js', ['reports.js', 'text/javascript; charset=utf-8']],
  ['/nav.js', ['nav.js', 'text/javascript; charset=utf-8']],
  ['/openapi.json', ['openapi.json', 'application/json; charset=utf-8']],
  ['/terms', ['terms.html', 'text/html; charset=utf-8']],
  ['/terms/', ['terms.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/llms.txt', ['llms.txt', 'text/plain; charset=utf-8']],
  ['/robots.txt', ['robots.txt', 'text/plain; charset=utf-8']],
  ['/sitemap.xml', ['sitemap.xml', 'application/xml; charset=utf-8']],
]);

// A contract a provider published after the last registry review is genuine
// but not yet a registry record; say so instead of treating it as unknown.
async function checkContract(address) {
  const registered = baseRecords.find((record) => record.contractAddress === address);
  if (registered) return { address, verdict: 'registered', record: registered };
  const pending = pendingProvider(address, latestObservation);
  if (pending) return { address, verdict: 'pending_review', provider: pending.provider, published: { symbol: pending.symbol, name: pending.name, ticker: pending.ticker }, observedAt: pending.observedAt };
  const cached = contractCheckCache.get(address);
  if (cached && Date.now() < cached.until) return cached.value;
  const identity = await readTokenIdentity(address);
  const lookalikes = findLookalikes(baseRecords, identity);
  const value = { address, verdict: lookalikeVerdict(identity, lookalikes), onchain: identity, lookalikes, checkedAt: new Date().toISOString() };
  if (contractCheckCache.size > 500) contractCheckCache.clear();
  contractCheckCache.set(address, { until: Date.now() + 600000, value });
  return value;
}

// ---- Public API v1 -------------------------------------------------------
const rateLimit = createRateLimiter({ limit: 120, windowMs: 60000 });
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};
const CACHE = {
  catalog: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  report: 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
  check: 'public, max-age=60, s-maxage=600',
  none: 'no-store',
};

function clientKey(request) {
  return String(request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
}

function sendV1(response, status, body, cache, limit) {
  const headers = { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, 'x-mintmark-api-version': API_VERSION };
  if (limit) Object.assign(headers, { 'x-ratelimit-limit': String(limit.limit), 'x-ratelimit-remaining': String(limit.remaining), 'x-ratelimit-reset': String(limit.reset) });
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function v1Error(response, error, limit) {
  const known = error instanceof ApiError;
  if (!known) console.error('v1 request failed:', error.message);
  sendV1(response, known ? error.status : 500, { error: { code: known ? error.code : 'internal_error', message: known ? error.message : 'Mintmark could not complete this request.' } }, CACHE.none, limit);
}

async function readBody(request, maxBytes = 32768) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new ApiError(413, 'body_too_large', 'Request body must be 32 KB or smaller.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.'); }
}

const meta = () => ({ apiVersion: API_VERSION, catalogSnapshotAt: snapshot.generatedAt, docs: 'https://mintmark.nuvixes.studio/docs#integrate' });

async function handleV1(request, response, url) {
  if (request.method === 'OPTIONS') { response.writeHead(204, CORS); response.end(); return; }
  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    response.setHeader?.('retry-after', String(Math.max(1, limit.reset - Math.floor(Date.now() / 1000))));
    return v1Error(response, new ApiError(429, 'rate_limited', `Limit is ${limit.limit} requests a minute per client. Use POST /v1/tokens/lookup for many addresses.`), limit);
  }
  try {
    const parts = url.pathname.replace(/\/+$/, '').split('/').slice(2).map((part) => { try { return decodeURIComponent(part); } catch { throw new ApiError(400, 'invalid_path', 'The URL path is not valid.'); } });
    const [resource, a, b] = parts;
    const method = request.method;
    const allow = (expected) => { if (method !== expected) throw new ApiError(405, 'method_not_allowed', `Use ${expected} for this endpoint.`); };

    if (!resource) {
      allow('GET');
      return sendV1(response, 200, { meta: meta(), endpoints: [
        'GET /v1/health', 'GET /v1/tokens?q=&provider=&limit=&offset=', 'GET /v1/tokens/{chainId}/{address}',
        `POST /v1/tokens/lookup  {"addresses": [up to ${MAX_LOOKUP}]}`, 'GET /v1/companies/{ticker}',
        'GET /v1/check/{chainId}/{address}', 'GET /v1/reports', 'GET /v1/reports/latest', 'GET /v1/reports/{date}',
      ], openapi: 'https://mintmark.nuvixes.studio/openapi.json' }, CACHE.catalog, limit);
    }
    if (resource === 'health' && !a) {
      allow('GET');
      const providers = snapshot.source?.providers ?? {};
      return sendV1(response, 200, { status: 'ok', meta: meta(), tokens: baseRecords.length,
        providers: Object.fromEntries(Object.entries(providers).map(([id, p]) => [id, { tokens: p.count, checkedAt: p.checkedAt ?? snapshot.generatedAt }])),
        latestReport: (await readReportFile('index.json'))?.reports?.[0]?.date ?? null }, CACHE.none, limit);
    }
    if (resource === 'tokens' && a === 'lookup' && !b) {
      allow('POST');
      const body = await readBody(request);
      return sendV1(response, 200, { meta: meta(), results: lookupTokens(body.addresses, baseRecords, latestObservation) }, CACHE.none, limit);
    }
    if (resource === 'tokens' && !a) {
      allow('GET');
      const view = searchView(baseRecords, Object.fromEntries(url.searchParams), searchRecords);
      return sendV1(response, 200, { meta: meta(), ...view }, CACHE.catalog, limit);
    }
    if (resource === 'tokens' && a && b && parts.length === 3) {
      allow('GET');
      parseChainId(a);
      const address = parseAddress(b);
      const record = baseRecords.find((item) => item.contractAddress === address);
      if (record) return sendV1(response, 200, { meta: meta(), token: tokenView(record) }, CACHE.catalog, limit);
      const pending = pendingProvider(address, latestObservation);
      if (pending) return sendV1(response, 404, { error: { code: 'pending_review', message: `${pending.provider} published this contract as ${pending.symbol}; it is not a reviewed registry record yet.` }, published: pending }, CACHE.catalog, limit);
      throw new ApiError(404, 'not_registered', 'This contract is not in the Mintmark registry. GET /v1/check/56/{address} reads it onchain and lists look-alikes.');
    }
    if (resource === 'companies' && a && !b) {
      allow('GET');
      return sendV1(response, 200, { meta: meta(), company: companyView(baseRecords, a) }, CACHE.catalog, limit);
    }
    if (resource === 'check' && a && b && parts.length === 3) {
      allow('GET');
      parseChainId(a);
      const address = parseAddress(b);
      let result;
      try { result = await checkContract(address); }
      catch (error) { throw new ApiError(502, 'chain_unavailable', `The BSC contract could not be read: ${error.message}`); }
      const body = result.verdict === 'registered' ? { verdict: 'registered', address, token: tokenView(result.record) } : result;
      return sendV1(response, 200, { meta: meta(), ...body }, CACHE.check, limit);
    }
    if (resource === 'reports') {
      allow('GET');
      const index = await readReportFile('index.json');
      if (!a) return sendV1(response, 200, { meta: meta(), reports: index?.reports ?? [] }, CACHE.report, limit);
      const date = a === 'latest' ? index?.reports?.[0]?.date : a;
      if (!date) throw new ApiError(404, 'report_not_found', 'No daily report has been published yet.');
      if (!isReportDate(date)) throw new ApiError(400, 'invalid_date', 'Use a report date in YYYY-MM-DD format, or latest.');
      const report = await readReportFile(`${date}.json`);
      if (!report) throw new ApiError(404, 'report_not_found', `No daily report for ${date}.`);
      return sendV1(response, 200, { meta: meta(), report }, CACHE.report, limit);
    }
    throw new ApiError(404, 'not_found', 'Unknown v1 endpoint. GET /v1 lists them.');
  } catch (error) {
    return v1Error(response, error, limit);
  }
}

export default async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) return await handleV1(request, response, url);
    if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed' });
    if (url.pathname === '/api/health') return sendJson(response, 200, {
      status: 'ok', count: baseRecords.length, snapshotAt: snapshot.generatedAt,
      checkedAt: new Date().toISOString(), binanceConfigured: hasBinanceCredentials(),
    });
    if (url.pathname === '/api/reports') {
      const index = await readReportFile('index.json');
      return sendJson(response, 200, { reports: index?.reports ?? [] });
    }
    if (url.pathname === '/api/reports/feed.xml') {
      const index = await readReportFile('index.json');
      response.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' });
      response.end(renderRss(index, siteUrl));
      return;
    }
    if (url.pathname === '/api/daily-report') {
      const index = await readReportFile('index.json');
      const date = url.searchParams.get('date') ?? index?.reports?.[0]?.date;
      if (!date) return sendJson(response, 404, { error: 'No daily report has been published yet.' });
      if (!isReportDate(date)) return sendJson(response, 400, { error: 'Use a report date in YYYY-MM-DD format.' });
      const report = await readReportFile(`${date}.json`);
      return report ? sendJson(response, 200, { report }) : sendJson(response, 404, { error: 'No daily report for that date.' });
    }
    if (url.pathname === '/api/catalog.json' || url.pathname === '/api/catalog.csv') {
      const rows = exportRows(baseRecords);
      const csv = url.pathname.endsWith('.csv');
      const stamp = String(snapshot.generatedAt).slice(0, 10);
      response.writeHead(200, {
        'content-type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
        'content-disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="mintmark-catalog-${stamp}.${csv ? 'csv' : 'json'}"`,
        'cache-control': 'public, max-age=600', 'access-control-allow-origin': '*',
      });
      response.end(csv ? toCsv(rows) : JSON.stringify({ snapshotAt: snapshot.generatedAt, count: rows.length, records: rows }));
      return;
    }
    if (url.pathname === '/api/contract-check') {
      const address = normalizeAddress(url.searchParams.get('address'));
      if (!address) return sendJson(response, 400, { error: 'Enter a complete 0x BSC contract address.' });
      try {
        const result = await checkContract(address);
        return sendJson(response, 200, result.verdict === 'registered' ? { address, verdict: 'registered', record: directoryRecord(result.record) } : result);
      } catch (error) {
        return sendJson(response, 502, { error: `The BSC contract could not be read: ${error.message}` });
      }
    }
    if (url.pathname === '/api/records') {
      const { records, binance } = await currentRecords();
      const query = url.searchParams.get('q') ?? '';
      if (query.length > 120) return sendJson(response, 400, { error: 'Search is too long' });
      const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
      const requestedOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 250) : 50;
      const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
      const matched = searchRecords(records, query);
      const page = matched.slice(offset, offset + limit);
      return sendJson(response, 200, {
        records: page.map(directoryRecord), query, offset, limit,
        total: matched.length, catalogTotal: records.length, hasMore: offset + page.length < matched.length,
        snapshotAt: snapshot.generatedAt, checkedAt: new Date().toISOString(),
        providers: snapshot.source.providers, binance,
      });
    }
    if (url.pathname === '/api/record') {
      const key = url.searchParams.get('key') ?? '';
      const { records, binance } = await currentRecords();
      const record = records.find((item) => item.key === key.toLowerCase());
      return record
        ? sendJson(response, 200, { record: { ...record, dexRoute: await getDexRoute(record) }, snapshotAt: snapshot.generatedAt, binance })
        : sendJson(response, 404, { error: 'No registry record for that exact BSC token identity.' });
    }
    if (url.pathname === '/api/report') {
      const key = (url.searchParams.get('key') ?? '').toLowerCase();
      const record = baseRecords.find((item) => item.key === key);
      if (!record) return sendJson(response, 404, { error: 'No registry record for that exact BSC token identity.' });
      if (record.platformId !== 'xstock' && !hasBinanceCredentials()) return sendJson(response, 503, {
        code: 'live_data_not_configured', error: 'Live Binance company data is not enabled on this deployment.',
      });
      try {
        return sendJson(response, 200, { report: await currentReport(record) });
      } catch (error) {
        return sendJson(response, 502, { error: `Company report is unavailable: ${error.message}` });
      }
    }
    if (url.pathname === '/api/history') {
      const key = (url.searchParams.get('key') ?? '').toLowerCase();
      const entry = history.records[key];
      if (!entry) return sendJson(response, 404, { error: 'No history for that exact BSC token identity.' });
      const { records, binance } = await currentRecords();
      const record = records.find((item) => item.key === key);
      const unresolved = [
        ...(record?.sourceConflict ? [{ source: 'Provider listing vs BSC contract', observedAt: record.observedAt, detail: record.sourceConflict }] : []),
        ...(record?.binanceCheck?.state === 'conflict' ? [{ source: 'Binance RWA Data', observedAt: record.binanceCheck.observedAt, detail: record.binanceCheck.detail }] : []),
      ];
      return sendJson(response, 200, { key, entries: entry.entries, unresolved, liveCheckState: binance.state });
    }
    if (url.pathname === '/api/wallet') {
      const address = normalizeAddress(url.searchParams.get('address'));
      if (!address) return sendJson(response, 400, { error: 'Enter a complete 0x BSC wallet address.' });
      if (!hasBinanceCredentials()) return sendJson(response, 503, {
        code: 'live_data_not_configured', error: 'Live wallet lookup is not enabled on this deployment.',
      });
      try {
        return sendJson(response, 200, { wallet: await currentWallet(address) });
      } catch (error) {
        return sendJson(response, 502, { error: `Wallet lookup is unavailable: ${error.message}` });
      }
    }
    const logoMatch = /^\/logos\/([A-Z0-9]{1,10})\.png$/.exec(url.pathname);
    if (logoMatch) {
      const ticker = logoMatch[1];
      if (!baseRecords.some((record) => record.underlyingTicker === ticker)) return sendJson(response, 404, { error: 'Logo not found' });
      const logoRoot = path.join(root, 'public', 'logos');
      const png = path.join(logoRoot, `${ticker}.png`);
      const jpg = path.join(logoRoot, `${ticker}.jpg`);
      const filename = existsSync(png) ? png : existsSync(jpg) ? jpg : null;
      if (!filename) return sendJson(response, 404, { error: 'Logo not found' });
      const bytes = await readFile(filename);
      response.writeHead(200, { 'content-type': filename.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'public, max-age=3600' });
      response.end(bytes);
      return;
    }
    const staticEntry = staticFiles.get(url.pathname);
    if (!staticEntry) return sendJson(response, 404, { error: 'Not found' });
    const [name, contentType] = staticEntry;
    const bytes = await readFile(path.join(root, 'public', name));
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-cache' });
    response.end(bytes);
  } catch (error) {
    console.error('Request failed:', error.message);
    sendJson(response, 500, { error: 'Mintmark could not complete this request.' });
  }
}
