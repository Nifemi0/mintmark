import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeRecords } from '../registry.mjs';
import { buildSpotPairs, SPOT_EXCHANGE_INFO_URL } from '../spot.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'catalog.json'), 'utf8'));
const records = normalizeRecords(snapshot.records);

const response = await fetch(SPOT_EXCHANGE_INFO_URL, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Binance Spot exchangeInfo returned HTTP ${response.status}`);
const result = buildSpotPairs(records, await response.json(), new Date().toISOString());

await writeFile(path.join(root, 'data', 'binance-spot.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Binance Spot: ${Object.keys(result.pairs).length} bStocks pairs trading, ${result.missing.length} not verified.`);
for (const item of result.missing) console.log(`  not verified: ${item.symbol} (${item.status})`);
