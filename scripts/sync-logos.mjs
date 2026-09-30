import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const records = JSON.parse(await readFile(path.join(root, 'data', 'ondo-bsc.json'), 'utf8')).records;
const directory = path.join(root, 'public', 'logos');
await mkdir(directory, { recursive: true });

async function saveLogo(record) {
  const { underlyingTicker: ticker, logoUrl } = record;
  if (!/^https:\/\/cdn\.ondo\.finance\/tokens\/logos\/[a-z0-9]+_160x160\.png$/.test(logoUrl)) {
    throw new Error(`Unexpected issuer logo URL for ${ticker}`);
  }
  let bytes;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(logoUrl, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error('Invalid PNG image');
      }
      break;
    } catch (error) {
      if (attempt === 2) throw new Error(`${ticker}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  await writeFile(path.join(directory, `${ticker}.png`), bytes);
  await rm(path.join(directory, `${ticker}.jpg`), { force: true });
  return { ticker, url: logoUrl, bytes: bytes.length };
}

const results = [], failures = [];
for (let offset = 0; offset < records.length; offset += 8) {
  const batch = await Promise.allSettled(records.slice(offset, offset + 8).map(saveLogo));
  for (const result of batch) {
    if (result.status === 'fulfilled') results.push(result.value);
    else failures.push(result.reason.message);
  }
  if ((offset + 8) % 80 === 0 || offset + 8 >= records.length) {
    console.log(`Downloaded ${results.length}/${records.length} issuer logos`);
  }
}
await writeFile(path.join(directory, 'sources.json'), JSON.stringify({
  description: 'Ondo-published token images for visual recognition. Chain and exact contract remain the identity evidence.',
  generatedAt: new Date().toISOString(), images: results, failures,
}, null, 2) + '\n');
if (failures.length) throw new Error(`Could not download ${failures.length} logos: ${failures.slice(0, 5).join('; ')}`);
console.log(`Saved all ${results.length} issuer logos to public/logos`);
