import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Each provider must have been checked within the limit. bStocks can only be
// refreshed with Binance credentials, so a stale bStocks list says so.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'catalog.json'), 'utf8'));
const maxAgeHours = Number(process.env.MAX_CATALOG_AGE_HOURS ?? 48);
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error('MAX_CATALOG_AGE_HOURS must be positive.');

const labels = { ondo: 'Ondo', bstock: 'bStocks', xstock: 'xStocks' };
const providers = snapshot.source?.providers ?? {};
const stale = [];
console.log(`Catalog snapshot: ${snapshot.generatedAt}`);
for (const [id, label] of Object.entries(labels)) {
  const checkedAt = providers[id]?.checkedAt ?? snapshot.generatedAt;
  const age = (Date.now() - new Date(checkedAt).getTime()) / 3_600_000;
  if (!Number.isFinite(age)) throw new Error(`${label} check time is invalid.`);
  console.log(`${label}: ${providers[id]?.count ?? 0} records, checked ${checkedAt} (${age.toFixed(1)} hours ago)`);
  if (age > maxAgeHours) stale.push({ id, label, age });
}

if (stale.length) {
  for (const item of stale) {
    const hint = item.id === 'bstock'
      ? 'bStocks are only published through the signed Binance RWA API: add OC_API_KEY and OC_SECRET_KEY, then run npm run sync.'
      : 'Run npm run sync, review the changes, and commit the refreshed snapshot.';
    console.error(`${item.label} is older than ${maxAgeHours} hours. ${hint}`);
  }
  process.exitCode = 1;
} else {
  console.log('Catalog freshness check passed.');
}
