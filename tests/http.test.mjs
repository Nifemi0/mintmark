import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from '../api/index.mjs';

test('deployment entry serves the front end, catalog health, logos, and xStocks unavailable state', async () => {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Every token has a/);

    const health = await fetch(`${base}/api/health`).then((response) => response.json());
    assert.equal(health.status, 'ok');
    assert.equal(health.count, 1565);

    const logo = await fetch(`${base}/logos/NVDA.png`);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get('content-type'), 'image/png');

    const snapshot = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url)));
    const xstock = snapshot.records.find((record) => record.platformId === 'xstock' && record.underlyingTicker === 'NVDA');
    const report = await fetch(`${base}/api/report?key=${encodeURIComponent(xstock.key)}`).then((response) => response.json());
    assert.equal(report.report.availability, 'identity_only');

    const ondo = snapshot.records.find((record) => record.platformId === 'ondo' && record.underlyingTicker === 'NVDA');
    const unavailable = await fetch(`${base}/api/report?key=${encodeURIComponent(ondo.key)}`);
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, 'live_data_not_configured');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
