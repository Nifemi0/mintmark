import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_FIELDS, exportRows, toCsv } from '../catalog-export.mjs';
import handler from '../api/index.mjs';

test('CSV export quotes commas and quotes and neutralises formula cells', () => {
  const rows = exportRows([{ key: '56:0xa', contractAddress: '0xa', platformId: 'ondo', issuer: 'Ondo, Inc.', symbol: '=HYPERLINK("x")', tokenName: 'Say "hi"', underlyingTicker: 'X', companyName: 'X', tradingStatus: { halted: true, observedAt: 't' } }]);
  const [header, line] = toCsv(rows).trim().split('\r\n');
  assert.equal(header, EXPORT_FIELDS.join(','));
  assert.match(line, /"Ondo, Inc\."/);
  assert.match(line, /"'=HYPERLINK\(""x""\)"/);
  assert.match(line, /"Say ""hi"""/);
  assert.equal(rows[0].tradingHalted, true);
});

function call(url) {
  return new Promise((resolve) => {
    const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { resolve({ status: this.status, headers: this.headers, body: String(body) }); } };
    handler({ method: 'GET', url, headers: { host: 'localhost' } }, response);
  });
}

test('catalog endpoints export every registry record', async () => {
  const json = await call('/api/catalog.json');
  const payload = JSON.parse(json.body);
  assert.equal(payload.count, 1937);
  assert.equal(payload.records.length, 1937);
  const csv = await call('/api/catalog.csv?download');
  assert.match(csv.headers['content-disposition'], /attachment; filename="mintmark-catalog-/);
  assert.equal(csv.body.trim().split("\r\n").length, 1938);
});

test('contract check recognises a registered contract without an onchain call', async () => {
  const result = JSON.parse((await call('/api/contract-check?address=0xa9ee28c80f960b889dfbd1902055218cba016f75')).body);
  assert.equal(result.verdict, 'registered');
  assert.equal(result.record.symbol, 'NVDAon');
  assert.equal((await call('/api/contract-check?address=nope')).status, 400);
});

test('contract check marks a provider-published contract that awaits registry review', async () => {
  const { readFile } = await import('node:fs/promises');
  const state = JSON.parse(await readFile(new URL('../data/state/report-observation.json', import.meta.url), 'utf8')).observation;
  const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
  const known = new Set(catalog.records.map((record) => record.contractAddress.toLowerCase()));
  const pending = Object.keys(state.ondo).find((address) => !known.has(address));
  if (!pending) return;
  const result = JSON.parse((await call(`/api/contract-check?address=${pending}`)).body);
  assert.equal(result.verdict, 'pending_review');
  assert.equal(result.provider, 'Ondo');
});
