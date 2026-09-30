import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { crossCheckBinance, normalizeAddress, normalizeRecords, searchRecords, classifyEvidence } from './registry.mjs';
import { getRwaTokens, getUnderlyingProfile, getUnderlyingMarket, getTokenCandles, getKnownTokenBalances, hasBinanceCredentials } from './binance.mjs';
import { buildCompanyReport } from './report.mjs';
import { mapWalletHoldings } from './wallet.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'catalog.json'), 'utf8'));
const history = JSON.parse(await readFile(path.join(root, 'data', 'registry-history.json'), 'utf8'));
const baseRecords = normalizeRecords(snapshot.records);
for (const record of baseRecords) for (const evidence of record.evidence) classifyEvidence(evidence.kind);

let binanceCache = { until: 0, result: null, promise: null };
const reportCache = new Map();
const walletCache = new Map();

async function currentReport(record) {
  const cached = reportCache.get(record.key);
  if (cached && Date.now() < cached.until) return cached.promise;
  const promise = record.platformId === 'xstock' ? Promise.resolve({
    key: record.key,
    availability: 'identity_only',
    company: { name: record.companyName, ticker: record.underlyingTicker, industry: null, description: null, website: null, ceo: null, sourceKind: 'issuer_published', sourceUrl: record.publisherUrl, retrievedAt: record.observedAt },
    underlyingMarket: { referencePrice: null, marketCap: null, high52W: null, low52W: null, volumeShares24H: null, peRatioTTM: null, pbRatio: null, dividendYield: null, latestDividend: null, marketStatus: record.tradingHalted ? 'Trading halted' : null, sourceKind: 'issuer_published', sourceUrl: record.publisherUrl, retrievedAt: record.observedAt },
    tokenMovement: { points: [], firstClose: null, lastClose: null, changePct: null, firstAt: null, lastAt: null, sourceKind: 'issuer_published', sourceUrl: record.publisherUrl, retrievedAt: record.observedAt, description: 'A contract-verified xStock. Mintmark has no independently checked price series for this token.' },
  }) : (async () => {
    const profile = await getUnderlyingProfile(record.contractAddress);
    const market = await getUnderlyingMarket(record.contractAddress);
    const candles = await getTokenCandles(record.contractAddress);
    return buildCompanyReport(record, profile, market, candles);
  })();
  reportCache.set(record.key, { until: Date.now() + 300000, promise });
  promise.catch(() => reportCache.delete(record.key));
  return promise;
}

async function currentWallet(address) {
  const cached = walletCache.get(address);
  if (cached && Date.now() < cached.until) return cached.promise;
  const promise = getKnownTokenBalances(address, baseRecords.filter((record) => record.walletLookupEnabled).map((record) => record.contractAddress)).then((result) =>
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
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function directoryRecord(record) {
  return {
    key: record.key, contractAddress: record.contractAddress, companyName: record.companyName,
    underlyingTicker: record.underlyingTicker, symbol: record.symbol, issuer: record.issuer,
    category: record.category, featured: record.featured, platformId: record.platformId,
    providerName: record.providerName ?? record.issuer, logoUrl: record.logoUrl,
    issuerTermsUrl: record.issuerTermsUrl,
  };
}

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

export default async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed' });
    if (url.pathname === '/api/health') return sendJson(response, 200, {
      status: 'ok', count: baseRecords.length, snapshotAt: snapshot.generatedAt,
      binanceConfigured: hasBinanceCredentials(),
    });
    if (url.pathname === '/api/records') {
      const { records, binance } = await currentRecords();
      const query = url.searchParams.get('q') ?? '';
      if (query.length > 120) return sendJson(response, 400, { error: 'Search is too long' });
      return sendJson(response, 200, {
        records: searchRecords(records, query).map(directoryRecord), query,
        total: records.length, snapshotAt: snapshot.generatedAt,
        providers: snapshot.source.providers, binance,
      });
    }
    if (url.pathname === '/api/record') {
      const key = url.searchParams.get('key') ?? '';
      const { records, binance } = await currentRecords();
      const record = records.find((item) => item.key === key.toLowerCase());
      return record
        ? sendJson(response, 200, { record, snapshotAt: snapshot.generatedAt, binance })
        : sendJson(response, 404, { error: 'No registry record for that exact BSC token identity.' });
    }
    if (url.pathname === '/api/report') {
      const key = (url.searchParams.get('key') ?? '').toLowerCase();
      const record = baseRecords.find((item) => item.key === key);
      if (!record) return sendJson(response, 404, { error: 'No registry record for that exact BSC token identity.' });
      if (record.platformId !== 'xstock' && !hasBinanceCredentials()) return sendJson(response, 503, { error: 'Company reports require Binance API credentials.' });
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
        ...(record?.sourceConflict ? [{ source: 'Ondo CSV vs BSC contract', observedAt: record.observedAt, detail: record.sourceConflict }] : []),
        ...(record?.binanceCheck?.state === 'conflict' ? [{ source: 'Binance RWA Data', observedAt: record.binanceCheck.observedAt, detail: record.binanceCheck.detail }] : []),
      ];
      return sendJson(response, 200, { key, entries: entry.entries, unresolved, liveCheckState: binance.state });
    }
    if (url.pathname === '/api/wallet') {
      const address = normalizeAddress(url.searchParams.get('address'));
      if (!address) return sendJson(response, 400, { error: 'Enter a complete 0x BSC wallet address.' });
      if (!hasBinanceCredentials()) return sendJson(response, 503, { error: 'Wallet lookup requires Binance API credentials.' });
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
