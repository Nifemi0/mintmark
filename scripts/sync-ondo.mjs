import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BSC_CHAIN_ID, identityKey, normalizeRecords } from '../registry.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const csvUrl = 'https://www.dropbox.com/scl/fi/qjfxyg748mx0dwi6up86d/EXTERNAL-Ondo-GM-Tokens-Ondo-GM-Tokens.csv?rlkey=n3no1w78wrah3umsl0nr9s77i&dl=1';
const publisherUrl = 'https://docs.ondo.finance/addresses';
const issuerTermsUrl = 'https://app.ondo.finance/legal-documentation';
const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
// Editorial browse labels help visitors discover assets; they are not issuer claims.
const discovery = {
  AAPL: { category: 'Technology', keywords: ['devices', 'phones'] },
  NVDA: { category: 'Technology', keywords: ['chips', 'semiconductors', 'ai'] },
  MSFT: { category: 'Technology', keywords: ['software', 'cloud', 'ai'] },
  GOOGL: { category: 'Technology', keywords: ['search', 'internet', 'ai'] },
  META: { category: 'Technology', keywords: ['social media', 'advertising'] },
  AMD: { category: 'Technology', keywords: ['chips', 'semiconductors', 'ai'] },
  PLTR: { category: 'Technology', keywords: ['software', 'data', 'ai'] },
  JPM: { category: 'Finance', keywords: ['bank', 'banking'] },
  V: { category: 'Finance', keywords: ['payments', 'cards'] },
  COIN: { category: 'Finance', keywords: ['crypto', 'exchange'] },
  AMZN: { category: 'Consumer', keywords: ['shopping', 'retail', 'cloud'] },
  TSLA: { category: 'Consumer', keywords: ['electric cars', 'vehicles'] },
  WMT: { category: 'Consumer', keywords: ['shopping', 'retail'] },
  COST: { category: 'Consumer', keywords: ['shopping', 'retail'] },
  DIS: { category: 'Consumer', keywords: ['entertainment', 'media'] },
  NFLX: { category: 'Consumer', keywords: ['entertainment', 'streaming'] },
  LLY: { category: 'Healthcare', keywords: ['medicine', 'pharma'] },
  JNJ: { category: 'Healthcare', keywords: ['medicine', 'pharma'] },
  XOM: { category: 'Energy', keywords: ['oil', 'gas'] },
  CVX: { category: 'Energy', keywords: ['oil', 'gas'] },
  SPY: { category: 'Funds', keywords: ['etf', 's&p 500', 'index fund'] },
  QQQ: { category: 'Funds', keywords: ['etf', 'nasdaq', 'index fund'] },
  IWM: { category: 'Funds', keywords: ['etf', 'russell 2000', 'small cap'] },
  GLD: { category: 'Funds', keywords: ['etf', 'gold'] },
};
const tickers = Object.keys(discovery);

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, '')) ?? [];
  return rows.filter((cells) => cells.length > 1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`BSC RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`BSC RPC ${payload.error.code}: ${payload.error.message}`);
  return payload.result;
}

export function decodeAbiString(raw) {
  if (typeof raw !== 'string' || !/^0x[0-9a-f]*$/i.test(raw) || raw.length < 130) throw new Error('Invalid ABI string');
  const offset = Number(BigInt(`0x${raw.slice(2, 66)}`));
  const lengthStart = 2 + offset * 2;
  const length = Number(BigInt(`0x${raw.slice(lengthStart, lengthStart + 64)}`));
  if (!Number.isSafeInteger(length) || length < 1 || length > 256) throw new Error('Unexpected ABI string length');
  const encoded = raw.slice(lengthStart + 64, lengthStart + 64 + length * 2);
  if (encoded.length !== length * 2) throw new Error('Truncated ABI string');
  return Buffer.from(encoded, 'hex').toString('utf8');
}

async function inspectBatch(rows) {
  const calls = rows.flatMap((row, index) => {
    const address = row['BSC Deployed Address'];
    return [
      { jsonrpc: '2.0', id: index * 3 + 1, method: 'eth_getCode', params: [address, 'latest'] },
      { jsonrpc: '2.0', id: index * 3 + 2, method: 'eth_call', params: [{ to: address, data: '0x95d89b41' }, 'latest'] },
      { jsonrpc: '2.0', id: index * 3 + 3, method: 'eth_call', params: [{ to: address, data: '0x06fdde03' }, 'latest'] },
    ];
  });
  let results;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(calls), signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`BSC RPC HTTP ${response.status}`);
      results = await response.json();
      if (!Array.isArray(results) || results.length !== calls.length) throw new Error('Incomplete BSC RPC batch');
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  const byId = new Map(results.map((result) => [result.id, result]));
  return rows.map((row, index) => {
    const base = index * 3;
    const values = [1, 2, 3].map((offset) => byId.get(base + offset));
    const error = values.find((value) => !value || value.error);
    if (error) return { error: error?.error?.message || 'Missing BSC RPC result' };
    const [code, symbolRaw, nameRaw] = values.map((value) => value.result);
    if (!code || code === '0x') return { error: 'No contract bytecode' };
    try {
      return { symbol: decodeAbiString(symbolRaw), name: decodeAbiString(nameRaw), codeBytes: (code.length - 2) / 2 };
    } catch (decodeError) { return { error: decodeError.message }; }
  });
}

async function main() {
  const rpcChainId = await rpc('eth_chainId', []);
  if (rpcChainId !== '0x38') throw new Error(`RPC is not BSC mainnet (expected 0x38, got ${rpcChainId})`);
  const response = await fetch(csvUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Ondo asset list HTTP ${response.status}`);
  const csv = await response.text();
  if (!csv.startsWith('Name,Symbol,')) throw new Error('Unexpected Ondo CSV format');
  const allRows = parseCsv(csv);
  const observedAt = new Date().toISOString();
  const candidates = allRows.filter((row) => ['Stock', 'ETF'].includes(row.Type) && row['BSC Deployed Address']);
  const priority = new Map(tickers.map((ticker, index) => [ticker, index]));
  candidates.sort((a, b) => (priority.get(a['Stock Ticker']) ?? 1000) - (priority.get(b['Stock Ticker']) ?? 1000)
    || a['Stock Ticker'].localeCompare(b['Stock Ticker']));
  const records = [], skipped = [];
  for (let offset = 0; offset < candidates.length; offset += 10) {
    const batch = candidates.slice(offset, offset + 10);
    const checks = await inspectBatch(batch);
    for (let index = 0; index < batch.length; index++) {
    const row = batch[index];
    const ticker = row['Stock Ticker'];
    const address = row['BSC Deployed Address'];
    const key = identityKey(BSC_CHAIN_ID, address);
    if (!key) { skipped.push({ ticker, address, reason: 'Invalid BSC contract address' }); continue; }
    const chain = checks[index];
    if (chain.error) { skipped.push({ ticker, address, reason: chain.error }); continue; }
    if (chain.symbol !== row.Symbol) {
      skipped.push({ ticker, address, reason: `Issuer/onchain symbol mismatch: ${row.Symbol} / ${chain.symbol}` });
      continue;
    }
    const issuerTokenName = row.Name.trim();
    const nameDifference = chain.name.trim() !== issuerTokenName;
    const explorerUrl = row['BscScan Token'] || `https://bscscan.com/token/${address}`;
    const logoUrl = `https://cdn.ondo.finance/tokens/logos/${row.Symbol.toLowerCase()}_160x160.png`;
    records.push({
      chainId: BSC_CHAIN_ID,
      contractAddress: address,
      issuer: 'Ondo Finance',
      platformId: 'ondo',
      symbol: row.Symbol,
      tokenName: chain.name,
      issuerTokenName,
      sourceConflict: nameDifference ? `Ondo lists “${issuerTokenName}”; the BSC contract reports “${chain.name}”. The exact contract and symbol match, but these names differ.` : null,
      underlyingTicker: ticker,
      companyName: row['Stock Name'],
      assetType: row.Type,
      category: row.Type === 'ETF' ? 'Funds' : 'Companies',
      keywords: discovery[ticker]?.keywords ?? [],
      featured: Boolean(discovery[ticker]),
      walletLookupEnabled: Boolean(discovery[ticker]),
      logoUrl,
      explorerUrl,
      issuerAssetUrl: `https://app.ondo.finance/assets/${row.Symbol.toLowerCase()}`,
      issuerTermsUrl,
      publisherUrl,
      observedAt,
      evidence: [
        { field: 'issuer', kind: 'issuer_published', value: 'Ondo Finance', sourceLabel: 'Ondo contract directory', sourceUrl: publisherUrl, observedAt },
        { field: 'contractAddress', kind: 'issuer_published', value: address, sourceLabel: 'Ondo asset list CSV', sourceUrl: csvUrl, observedAt },
        { field: 'chainId', kind: 'onchain_observed', value: 'BSC mainnet · 56 · contract bytecode present', sourceLabel: 'BSC token contract', sourceUrl: explorerUrl, observedAt },
        { field: 'symbol', kind: 'onchain_observed', value: chain.symbol, sourceLabel: 'BSC token contract', sourceUrl: explorerUrl, observedAt },
        { field: 'tokenName', kind: 'onchain_observed', value: chain.name, sourceLabel: 'BSC token contract', sourceUrl: explorerUrl, observedAt },
        ...(nameDifference ? [{ field: 'issuerTokenName', kind: 'issuer_published', value: issuerTokenName, sourceLabel: 'Ondo asset list CSV', sourceUrl: csvUrl, observedAt }] : []),
        { field: 'underlyingTicker', kind: 'issuer_published', value: ticker, sourceLabel: 'Ondo asset list CSV', sourceUrl: csvUrl, observedAt },
        { field: 'companyName', kind: 'issuer_published', value: row['Stock Name'], sourceLabel: 'Ondo asset list CSV', sourceUrl: csvUrl, observedAt },
        { field: 'custody', kind: 'unverified', value: 'No independent custody check is performed by Mintmark.', sourceLabel: 'Mintmark limitation', sourceUrl: null, observedAt },
      ],
    });
    }
    console.log(`Checked ${Math.min(offset + batch.length, candidates.length)}/${candidates.length} issuer-listed BSC assets`);
  }
  const normalized = normalizeRecords(records);
  const dataDir = path.join(root, 'data');
  await mkdir(dataDir, { recursive: true });
  const snapshot = {
    generatedAt: observedAt,
    source: { publisherUrl, csvUrl, csvSha256: createHash('sha256').update(csv).digest('hex'), candidateCount: candidates.length, skipped },
    records: normalized,
  };
  await writeFile(path.join(dataDir, 'ondo-bsc.json'), JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Saved ${normalized.length} checked Ondo records; skipped ${skipped.length} candidates.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
