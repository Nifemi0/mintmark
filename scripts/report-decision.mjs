// Prints "publish" or "review" for the latest report, with reasons, for the daily workflow.
import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { reviewReasons } from '../daily-report.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const index = JSON.parse(await readFile(path.join(root, 'data', 'reports', 'index.json'), 'utf8'));
const report = JSON.parse(await readFile(path.join(root, 'data', 'reports', `${index.reports[0].date}.json`), 'utf8'));
const reasons = reviewReasons(report);
const decision = reasons.length ? 'review' : 'publish';
console.log(`${report.date}: ${decision}${reasons.length ? ` (${reasons.join('; ')})` : ''}`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `decision=${decision}\ndate=${report.date}\nreasons=${reasons.join('; ')}\n`);
}
