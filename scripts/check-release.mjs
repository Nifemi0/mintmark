import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRecords } from '../registry.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const privateEnv = path.join(root, '.env.local');
const secrets = existsSync(privateEnv)
  ? readFileSync(privateEnv, 'utf8').split(/\r?\n/).map((line) => /^OC_(?:API_KEY|SECRET_KEY)=(.+)$/.exec(line)?.[1]).filter((value) => value && value.length > 8)
  : [];
const textExtensions = new Set(['.mjs', '.js', '.json', '.md', '.html', '.css', '.txt']);
const violations = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.env.local') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(filename); continue; }
    if (!textExtensions.has(path.extname(entry.name)) && entry.name !== '.env.example') continue;
    const content = readFileSync(filename, 'utf8');
    if (secrets.some((value) => content.includes(value))) violations.push(path.relative(root, filename));
  }
}

walk(root);
const example = readFileSync(path.join(root, '.env.example'), 'utf8');
if (!/^OC_API_KEY=your_api_key$/m.test(example) || !/^OC_SECRET_KEY=your_secret_key$/m.test(example)) {
  violations.push('.env.example must contain placeholders');
}
const snapshot = JSON.parse(readFileSync(path.join(root, 'data', 'catalog.json'), 'utf8'));
const records = normalizeRecords(snapshot.records);
for (const [ticker, providers] of [
  ['NVDA', ['ondo', 'bstock', 'xstock']],
  ['TSLA', ['ondo', 'bstock', 'xstock']],
  ['AAPL', ['ondo', 'xstock']],
]) {
  const products = records.filter((record) => record.underlyingTicker === ticker);
  if (JSON.stringify(products.map((record) => record.platformId)) !== JSON.stringify(providers)) violations.push(`${ticker} provider coverage changed`);
  for (const product of products) {
    if (!/^https:\/\//.test(product.issuerTermsUrl ?? '')) violations.push(`${ticker} legal-document link missing`);
  }
}

if (violations.length) {
  console.error(`Release preflight failed: ${violations.join(', ')}`);
  process.exitCode = 1;
} else console.log(`Release preflight passed: ${records.length} checked contracts, three priority searches, legal-document links, and no private credentials in distributable text files.`);
