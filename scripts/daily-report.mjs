import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseCsv, decodeAbiString } from './sync-ondo.mjs';
import { getBstockRows } from '../bstock-source.mjs';
import { SPOT_EXCHANGE_INFO_URL } from '../spot.mjs';
import { buildReport, catalogObservation, upsertIndex } from '../daily-report.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const dataDir = path.join(root, 'data');
const reportsDir = path.join(dataDir, 'reports');
const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
const ondoCsvUrl = 'https://www.dropbox.com/scl/fi/qjfxyg748mx0dwi6up86d/EXTERNAL-Ondo-GM-Tokens-Ondo-GM-Tokens.csv?rlkey=n3no1w78wrah3umsl0nr9s77i&dl=1';
const xstocksUrl = 'https://api.xstocks.fi/api/v2/public/assets';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

async function readJson(file, fallback) {
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback;
}

async function fetchWithRetry(url, options = {}, parse = (response) => response.json()) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
      return await parse(response);
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}

async function observeOndo() {
  const csv = await fetchWithRetry(ondoCsvUrl, {}, (response) => response.text());
  if (!csv.startsWith('Name,Symbol,')) throw new Error('Unexpected Ondo CSV format');
  const tokens = {};
  for (const row of parseCsv(csv)) {
    const address = row['BSC Deployed Address'];
    if (!['Stock', 'ETF'].includes(row.Type) || !ADDRESS.test(address ?? '')) continue;
    tokens[address.toLowerCase()] = { symbol: row.Symbol, ticker: row['Stock Ticker'], name: row.Name };
  }
  return tokens;
}

async function observeXstocks() {
  const tokens = {};
  for (let page = 1; page <= 100; page++) {
    const payload = await fetchWithRetry(`${xstocksUrl}?network=BinanceSmartChain&pageSize=100&page=${page}`);
    if (!Array.isArray(payload.nodes) || typeof payload.page?.hasNextPage !== 'boolean') throw new Error('Unexpected xStocks API pagination');
    for (const asset of payload.nodes) {
      const address = asset.deployments?.find((item) => item.network === 'BinanceSmartChain')?.address;
      if (!ADDRESS.test(address ?? '') || !asset.symbol || !asset.underlyingSymbol) continue;
      tokens[address.toLowerCase()] = { symbol: asset.symbol, ticker: String(asset.underlyingSymbol).toUpperCase(), name: asset.name, halted: Boolean(asset.isTradingHalted) };
    }
    if (!payload.page.hasNextPage) return tokens;
  }
  throw new Error('xStocks pagination exceeded 100 pages');
}

async function observeBstocks() {
  let rows;
  // Direct where Binance allows it, else the production relay; otherwise not checked.
  try { ({ rows } = await getBstockRows()); }
  catch (error) { console.warn(error.message); return { source: 'not_checked', tokens: {} }; }
  const tokens = {};
  for (const row of rows) {
    if (row.platformId !== 'bstock' || String(row.binanceChainId) !== '56' || !ADDRESS.test(row.tokenContractAddress ?? '')) continue;
    tokens[row.tokenContractAddress.toLowerCase()] = { symbol: row.tokenSymbol, ticker: String(row.underlyingTicker).toUpperCase(), name: row.tokenName };
  }
  return { source: 'binance_rwa', tokens };
}

async function observeSpot() {
  const info = await fetchWithRetry(SPOT_EXCHANGE_INFO_URL);
  if (!Array.isArray(info.symbols)) throw new Error('Binance Spot exchangeInfo has no symbols list');
  const group = (item) => createHash('sha1').update(JSON.stringify((item.permissionSets ?? []).map((set) => [...set].sort()))).digest('hex').slice(0, 10);
  return Object.fromEntries(info.symbols.filter((item) => item.quoteAsset === 'USDT' && /B$/.test(item.baseAsset))
    .map((item) => [item.baseAsset, { status: item.status, group: group(item) }]));
}

// Read bytecode, symbol, and name for newly listed contracts.
async function checkOnchainBatch(batch) {
  const calls = batch.flatMap((address, index) => [
    { jsonrpc: '2.0', id: index * 3 + 1, method: 'eth_getCode', params: [address, 'latest'] },
    { jsonrpc: '2.0', id: index * 3 + 2, method: 'eth_call', params: [{ to: address, data: '0x95d89b41' }, 'latest'] },
    { jsonrpc: '2.0', id: index * 3 + 3, method: 'eth_call', params: [{ to: address, data: '0x06fdde03' }, 'latest'] },
  ]);
  const results = {};
  let replies = [];
  try {
    replies = await fetchWithRetry(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(calls) });
  } catch { /* every contract in the batch is retried by the caller */ }
  const byId = new Map((Array.isArray(replies) ? replies : []).map((reply) => [reply.id, reply]));
  batch.forEach((address, index) => {
    const [code, symbol, name] = [1, 2, 3].map((n) => byId.get(index * 3 + n)?.result);
    if (!code) return;
    if (code === '0x') { results[address] = { state: 'no_bytecode' }; return; }
    if (!symbol || !name) return;
    try { results[address] = { state: 'checked', symbol: decodeAbiString(symbol), name: decodeAbiString(name) }; }
    catch { results[address] = { state: 'unreadable' }; }
  });
  return results;
}

async function checkOnchain(addresses) {
  const results = {};
  let pending = addresses;
  // Public BSC RPC nodes can drop part of a batch; retry only what is missing.
  for (let round = 0; round < 4 && pending.length; round++) {
    if (round) await new Promise((resolve) => setTimeout(resolve, 1500 * round));
    for (let offset = 0; offset < pending.length; offset += 5) {
      Object.assign(results, await checkOnchainBatch(pending.slice(offset, offset + 5)));
    }
    pending = pending.filter((address) => !results[address]);
  }
  for (const address of pending) results[address] = { state: 'error', detail: 'BSC RPC returned no reply for this contract' };
  return results;
}

const catalog = await readJson(path.join(dataDir, 'catalog.json'));
const spotCheck = await readJson(path.join(dataDir, 'binance-spot.json'), null);
const productUpdates = await readJson(path.join(dataDir, 'product-updates.json'), { updates: [] });
const index = await readJson(path.join(reportsDir, 'index.json'), { schemaVersion: 1, reports: [] });
const stateDir = path.join(dataDir, 'state');
const observationFile = path.join(stateDir, 'report-observation.json');

const observedAt = new Date().toISOString();
const [ondo, xstock, bstock, spotPairs] = await Promise.all([observeOndo(), observeXstocks(), observeBstocks(), observeSpot()]);
const current = { observedAt, source: 'upstream', ondo, xstock, bstock: bstock.tokens, bstockSource: bstock.source, spotPairs };

const previousObservation = await readJson(observationFile, null);
const today = observedAt.slice(0, 10);
// Rerunning on the same day compares against the same baseline as the first run.
const previousEntry = index.reports.find((item) => item.date < today) ?? null;
const previous = previousObservation?.baseline && previousObservation.date === today
  ? previousObservation.baseline
  : previousObservation?.observation ?? catalogObservation(catalog, spotCheck);
const previousReport = previousEntry ? await readJson(path.join(reportsDir, `${previousEntry.date}.json`), null) : null;
// Without Binance credentials bStocks are not observed; carry the last known
// state forward so a later run with credentials compares against it.
if (current.bstockSource !== 'binance_rwa') current.bstock = previous.bstock ?? {};

const addedAddresses = [];
for (const provider of ['ondo', 'bstock', 'xstock']) {
  for (const address of Object.keys(current[provider])) if (!previous[provider]?.[address]) addedAddresses.push(address);
}
const onchain = await checkOnchain(addedAddresses);

const report = buildReport({ previous, current, catalog, previousReport, productUpdates: productUpdates.updates, onchain });
await mkdir(reportsDir, { recursive: true });
await mkdir(stateDir, { recursive: true });
await writeFile(path.join(reportsDir, `${report.date}.json`), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(reportsDir, 'index.json'), `${JSON.stringify(upsertIndex(index, report), null, 2)}\n`);
// Pretty-printed so daily commits store small diffs.
await writeFile(observationFile, `${JSON.stringify({ date: today, baseline: previous, observation: current }, null, 1)}\n`);

console.log(`Report ${report.date}: ${report.headline}`);
console.log(`bStocks contracts: ${report.bstockSource === 'binance_rwa' ? 'checked with Binance RWA data' : 'not checked (Binance credentials not configured)'}`);
