import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRwaTokens, hasBinanceCredentials } from '../binance.mjs';
import { normalizeRecords, identityKey } from '../registry.mjs';
import { evolveRegistryHistory } from '../history.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
const xstocksUrl = 'https://api.xstocks.fi/api/v2/public/assets';
const xstocksDocs = 'https://docs.xstocks.fi/apis/openapi/assets/list_public_assets';
const xstocksTerms = 'https://assets.backed.fi/legal-documentation';
const binanceDocs = 'https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data';
const bstockTerms = 'https://www.binance.com/en/about-legal/bstocks-digital-securities-documentation';
const bstockIssuerSource = 'https://www.binance.com/en-AU/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38';
const xstockIssuerSource = 'https://docs.xstocks.fi/docs/product-legal-overview';

async function json(url, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

function decodeString(raw) {
  if (typeof raw !== 'string' || !/^0x[0-9a-f]+$/i.test(raw)) throw new Error('Invalid ERC-20 string');
  // Standard dynamic string; a few older tokens return a bytes32 string.
  if (raw.length === 66) return Buffer.from(raw.slice(2), 'hex').toString('utf8').replace(/\0+$/, '');
  const offset = Number(BigInt(`0x${raw.slice(2, 66)}`));
  const start = 2 + offset * 2;
  const length = Number(BigInt(`0x${raw.slice(start, start + 64)}`));
  if (!Number.isSafeInteger(length) || length < 1 || length > 256) throw new Error('Invalid ERC-20 string length');
  return Buffer.from(raw.slice(start + 64, start + 64 + length * 2), 'hex').toString('utf8');
}

async function inspectBatch(rows) {
  const calls = rows.flatMap((row, index) => [
    { jsonrpc: '2.0', id: index * 3 + 1, method: 'eth_getCode', params: [row.address, 'latest'] },
    { jsonrpc: '2.0', id: index * 3 + 2, method: 'eth_call', params: [{ to: row.address, data: '0x95d89b41' }, 'latest'] },
    { jsonrpc: '2.0', id: index * 3 + 3, method: 'eth_call', params: [{ to: row.address, data: '0x06fdde03' }, 'latest'] },
  ]);
  let result;
  for (let attempt = 0; attempt < 4; attempt++) {
    result = await json(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(calls) });
    if (Array.isArray(result) && result.length === calls.length) break;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
  }
  if (!Array.isArray(result) || result.length !== calls.length) throw new Error(`Incomplete BSC RPC batch: ${JSON.stringify(result).slice(0, 200)}`);
  const byId = new Map(result.map((item) => [item.id, item]));
  return rows.map((_, index) => {
    const [code, symbol, name] = [1, 2, 3].map((offset) => byId.get(index * 3 + offset));
    if (!code?.result || code.result === '0x') return { error: 'No BSC contract bytecode' };
    if (!symbol?.result || !name?.result) return { error: 'Could not read ERC-20 name or symbol' };
    try { return { symbol: decodeString(symbol.result), name: decodeString(name.result) }; }
    catch (error) { return { error: error.message }; }
  });
}

async function xstockAssets() {
  const assets = [];
  for (let page = 1; page <= 100; page++) {
    const url = `${xstocksUrl}?network=BinanceSmartChain&pageSize=100&page=${page}`;
    const payload = await json(url);
    if (!Array.isArray(payload.nodes) || !payload.page || typeof payload.page.hasNextPage !== 'boolean') throw new Error('Unexpected xStocks API pagination');
    assets.push(...payload.nodes);
    console.log(`xStocks page ${page}: ${assets.length} assets`);
    if (!payload.page.hasNextPage) return assets;
  }
  throw new Error('xStocks pagination exceeded 100 pages');
}

function evidence(field, kind, value, sourceLabel, sourceUrl, observedAt) {
  return { field, kind, value, sourceLabel, sourceUrl, observedAt };
}

function xstockCandidate(asset) {
  const deployment = asset.deployments?.find((item) => item.network === 'BinanceSmartChain');
  const address = deployment?.address;
  if (!identityKey('56', address) || !asset.symbol || !asset.underlyingSymbol) return null;
  return { provider: 'xstock', address, asset, symbol: asset.symbol };
}

function bstockCandidate(row) {
  if (!identityKey(row.binanceChainId, row.tokenContractAddress) || !row.tokenSymbol || !row.underlyingTicker) return null;
  return { provider: 'bstock', address: row.tokenContractAddress, asset: row, symbol: row.tokenSymbol };
}

function makeRecord(candidate, chain, observedAt) {
  const { provider, asset, address } = candidate;
  const xstock = provider === 'xstock';
  const sourceUrl = xstock ? xstocksDocs : binanceDocs;
  const sourceLabel = xstock ? 'xStocks public asset API' : 'Binance RWA token list';
  const sourceKind = xstock ? 'issuer_published' : 'third_party_reported';
  const ticker = String(xstock ? asset.underlyingSymbol : asset.underlyingTicker).toUpperCase();
  const companyName = xstock ? asset.name.replace(/ xStock$/i, '') : asset.underlyingName;
  const publishedName = xstock ? asset.name : asset.tokenName;
  const type = /\b(ETF|ETN|FUND|TRUST)\b/i.test(companyName) ? 'ETF' : 'Stock';
  const explorerUrl = `https://bscscan.com/token/${address}`;
  return {
    chainId: '56', contractAddress: address, platformId: provider,
    issuer: xstock ? 'Backed Assets (JE) Limited' : 'BTech Holdings Limited',
    providerName: xstock ? 'xStocks' : 'bStocks',
    symbol: chain.symbol, tokenName: chain.name, issuerTokenName: publishedName,
    sourceConflict: chain.name.trim() !== (xstock ? publishedName : publishedName?.replace(/ \(bStocks\)$/i, '')).trim()
      ? `${sourceLabel} lists “${publishedName}”; the BSC contract reports “${chain.name}”.` : null,
    underlyingTicker: ticker, companyName: companyName || ticker, assetType: type,
    category: type === 'ETF' ? 'Funds' : 'Companies', keywords: [], featured: false,
    walletLookupEnabled: false, logoUrl: xstock ? asset.logo : asset.tokenLogoUrl,
    explorerUrl, issuerAssetUrl: xstock ? `https://api.xstocks.fi/api/v2/public/assets/${encodeURIComponent(asset.symbol)}` : null,
    issuerTermsUrl: xstock ? xstocksTerms : bstockTerms,
    publisherUrl: sourceUrl, observedAt,
    tradingHalted: xstock ? Boolean(asset.isTradingHalted) : null,
    evidence: [
      evidence('provider', sourceKind, xstock ? 'xStocks' : 'bStocks', sourceLabel, sourceUrl, observedAt),
      evidence('issuer', sourceKind, xstock ? 'Backed Assets (JE) Limited' : 'BTech Holdings Limited', xstock ? 'xStocks legal overview' : 'Binance bStocks FAQ', xstock ? xstockIssuerSource : bstockIssuerSource, observedAt),
      evidence('contractAddress', sourceKind, address, sourceLabel, sourceUrl, observedAt),
      evidence('underlyingTicker', sourceKind, ticker, sourceLabel, sourceUrl, observedAt),
      evidence('companyName', sourceKind, companyName || ticker, sourceLabel, sourceUrl, observedAt),
      ...(chain.name.trim() !== (xstock ? publishedName : publishedName?.replace(/ \(bStocks\)$/i, '')).trim()
        ? [evidence('issuerTokenName', sourceKind, publishedName, sourceLabel, sourceUrl, observedAt)] : []),
      evidence('chainId', 'onchain_observed', 'BSC mainnet · 56 · contract bytecode present', 'BSC token contract', explorerUrl, observedAt),
      evidence('symbol', 'onchain_observed', chain.symbol, 'BSC token contract', explorerUrl, observedAt),
      evidence('tokenName', 'onchain_observed', chain.name, 'BSC token contract', explorerUrl, observedAt),
      evidence('custody', 'unverified', 'No independent custody or backing check is performed by Mintmark.', 'Mintmark limitation', null, observedAt),
    ],
  };
}

async function main() {
  if (!hasBinanceCredentials()) throw new Error('Binance API credentials are needed to sync bStocks');
  const chain = await json(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
  if (chain.result !== '0x38') throw new Error('RPC is not BSC mainnet');
  const [binance, xstocks, ondo] = await Promise.all([
    getRwaTokens(), xstockAssets(), readFile(path.join(root, 'data', 'ondo-bsc.json'), 'utf8').then(JSON.parse),
  ]);
  const observedAt = new Date().toISOString();
  const candidates = [
    ...binance.rows.filter((row) => row.platformId === 'bstock').map(bstockCandidate),
    ...xstocks.map(xstockCandidate),
  ].filter(Boolean);
  const records = [], skipped = [];
  for (let offset = 0; offset < candidates.length; offset += 5) {
    const batch = candidates.slice(offset, offset + 5);
    const checks = await inspectBatch(batch);
    for (let i = 0; i < batch.length; i++) {
      const candidate = batch[i], check = checks[i];
      if (check.error) { skipped.push({ provider: candidate.provider, symbol: candidate.symbol, reason: check.error }); continue; }
      if (check.symbol.toLowerCase() !== candidate.symbol.toLowerCase()) {
        skipped.push({ provider: candidate.provider, symbol: candidate.symbol, reason: `Published/onchain symbol mismatch: ${check.symbol}` });
        continue;
      }
      records.push(makeRecord(candidate, check, observedAt));
    }
    if ((offset + 5) % 100 === 0 || offset + 5 >= candidates.length) console.log(`Checked ${Math.min(offset + 5, candidates.length)}/${candidates.length} additional BSC contracts`);
  }
  const all = normalizeRecords([...ondo.records, ...records]);
  const historyPath = path.join(root, 'data', 'registry-history.json');
  let oldHistory = null;
  try { oldHistory = JSON.parse(await readFile(historyPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (oldHistory) {
    const sourceByKey = new Map(all.map((record) => [record.key, record.publisherUrl]));
    for (const [key, state] of Object.entries(oldHistory.records)) {
      for (const entry of state.entries) {
        if (entry.sourceUrl === 'https://mintmark.local/provider-sync') entry.sourceUrl = sourceByKey.get(key) ?? null;
      }
    }
  }
  const history = evolveRegistryHistory(oldHistory, all, observedAt, null);
  const versioned = all.map((record) => ({ ...record, recordVersion: history.records[record.key].entries.at(-1).version }));
  const snapshot = {
    generatedAt: observedAt,
    source: { publisherUrl: null, providers: {
      ondo: { url: ondo.source.publisherUrl, count: ondo.records.length },
      bstock: { url: binanceDocs, count: records.filter((record) => record.platformId === 'bstock').length },
      xstock: { url: xstocksDocs, count: records.filter((record) => record.platformId === 'xstock').length },
    }, candidateCount: candidates.length, skipped },
    records: versioned,
  };
  await writeFile(historyPath, JSON.stringify(history, null, 2) + '\n');
  await writeFile(path.join(root, 'data', 'catalog.json'), JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Saved ${versioned.length} Mintmark records: ${JSON.stringify(snapshot.source.providers)}; skipped ${skipped.length}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
