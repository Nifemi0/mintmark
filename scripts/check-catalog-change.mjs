// Guards the automatic daily refresh: compares the refreshed catalog with the
// committed one and fails when a provider loses many tokens at once, which is
// far more likely a provider outage than real delistings.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const before = JSON.parse(execFileSync('git', ['show', 'HEAD:data/catalog.json'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
const after = JSON.parse(await readFile(path.join(root, 'data', 'catalog.json'), 'utf8'));
const keys = (catalog, provider) => new Set(catalog.records.filter((r) => r.platformId === provider).map((r) => r.contractAddress.toLowerCase()));

const problems = [];
for (const provider of ['ondo', 'bstock', 'xstock']) {
  const was = keys(before, provider), now = keys(after, provider);
  const removed = [...was].filter((k) => !now.has(k)).length;
  const added = [...now].filter((k) => !was.has(k)).length;
  console.log(`${provider}: ${was.size} -> ${now.size} (+${added}, -${removed})`);
  if (removed >= 10 || (was.size && removed / was.size > 0.05)) problems.push(`${provider} would lose ${removed} of ${was.size} tokens`);
}
if (problems.length) {
  console.error(`Catalog refresh held back: ${problems.join('; ')}.`);
  process.exitCode = 1;
}
