import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'catalog.json'), 'utf8'));
const generatedAt = new Date(snapshot.generatedAt);
const maxAgeHours = Number(process.env.MAX_CATALOG_AGE_HOURS ?? 48);
const ageHours = (Date.now() - generatedAt.getTime()) / 3_600_000;
const counts = snapshot.source?.providers ?? {};

if (!Number.isFinite(generatedAt.getTime())) throw new Error('Catalog generatedAt is invalid.');
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error('MAX_CATALOG_AGE_HOURS must be positive.');

console.log(`Catalog snapshot: ${snapshot.generatedAt}`);
console.log(`Catalog age: ${ageHours.toFixed(1)} hours (limit ${maxAgeHours} hours)`);
console.log(`Provider counts: Ondo ${counts.ondo?.count ?? 0}, bStocks ${counts.bstock?.count ?? 0}, xStocks ${counts.xstock?.count ?? 0}`);

if (ageHours > maxAgeHours) {
  console.error('Catalog freshness check failed. Run npm run sync, review the changes, and commit the refreshed snapshot.');
  process.exitCode = 1;
} else {
  console.log('Catalog freshness check passed.');
}
