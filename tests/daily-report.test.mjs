import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, bstockSpotCandidates, catalogObservation, compareObservations, renderRss, upsertIndex } from '../daily-report.mjs';
import handler from '../api/index.mjs';

const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40), C = '0x' + 'c'.repeat(40), D = '0x' + 'd'.repeat(40);
const catalog = { generatedAt: '2026-11-01T00:00:00.000Z', records: [
  { platformId: 'ondo', contractAddress: A, symbol: 'NVDAon', underlyingTicker: 'NVDA', tokenName: 'NVIDIA (Ondo Tokenized)' },
  { platformId: 'xstock', contractAddress: B, symbol: 'NVDAx', underlyingTicker: 'NVDA', tokenName: 'NVIDIA xStock', tradingHalted: false },
  { platformId: 'bstock', contractAddress: C, symbol: 'NVDAB', underlyingTicker: 'NVDA', tokenName: 'NVIDIA Corp' },
] };
const base = () => catalogObservation(catalog);
const spot = { NVDAB: { status: 'TRADING', group: 'g1' }, AAPLB: { status: 'TRADING', group: 'g1' }, ARB: { status: 'TRADING', group: 'g2' }, TSLAB: { status: 'BREAK', group: 'g1' } };

test('observation diff finds added, removed, changed, and halted tokens by exact contract', () => {
  const current = base();
  current.ondo[D] = { symbol: 'AAPLon', ticker: 'AAPL', name: 'Apple (Ondo Tokenized)' };
  current.xstock[B] = { ...current.xstock[B], halted: true, name: 'NVIDIA Corp xStock' };
  delete current.bstock[C];
  const diff = compareObservations(base(), current);
  assert.deepEqual(diff.added.map((item) => item.symbol), ['AAPLon']);
  assert.deepEqual(diff.removed.map((item) => item.symbol), ['NVDAB']);
  assert.deepEqual(diff.halts.map((item) => [item.symbol, item.halted]), [['NVDAx', true]]);
  assert.deepEqual(diff.changed[0].changes, [{ field: 'name', from: 'NVIDIA xStock', to: 'NVIDIA Corp xStock' }]);
});

test('bStocks are not reported as removed when Binance RWA data was not checked', () => {
  const current = { ...base(), bstock: {}, bstockSource: 'not_checked', observedAt: '2026-11-02T06:00:00.000Z', spotPairs: spot };
  const report = buildReport({ previous: base(), current, catalog });
  assert.equal(report.summary.removed, 0);
  assert.equal(report.bstockSource, 'not_checked');
  assert.deepEqual(report.bstockCandidates.map((item) => item.symbol), ['AAPLB']);
});

test('Spot candidates need the confirmed bStocks trading group and a trading status', () => {
  assert.deepEqual(bstockSpotCandidates(spot, new Set(['NVDAB'])).map((item) => item.symbol), ['AAPLB']);
  assert.deepEqual(bstockSpotCandidates({ AAPLB: 'TRADING' }, new Set(['NVDAB'])), []);
});

test('report separates changes since the last report from changes pending registry review', () => {
  const yesterday = { ...base(), source: 'upstream', observedAt: '2026-11-02T06:00:00.000Z', bstockSource: 'binance_rwa' };
  yesterday.ondo[D] = { symbol: 'AAPLon', ticker: 'AAPL', name: 'Apple (Ondo Tokenized)' };
  const today = structuredClone(yesterday);
  today.observedAt = '2026-11-03T06:00:00.000Z';
  today.xstock[B].halted = true;
  const report = buildReport({
    previous: yesterday, current: today, catalog, previousReport: { date: '2026-11-02', bstockCandidates: [] },
    productUpdates: [{ date: '2026-11-03', title: 'New' }, { date: '2026-11-02', title: 'Old' }, { date: '2026-11-04', title: 'Future' }],
  });
  assert.equal(report.date, '2026-11-03');
  assert.equal(report.summary.added, 0);
  assert.equal(report.summary.halts, 1);
  assert.deepEqual(report.summary.pendingReview, { added: 1, removed: 0, changed: 0, halts: 1 });
  assert.deepEqual(report.productUpdates.map((item) => item.title), ['New']);
  assert.equal(report.headline, '1 halted.');
  assert.equal(report.baseline.kind, 'previous_report');
});

test('report index keeps one entry per date, newest first, and feeds RSS', () => {
  const make = (date, headline) => ({ date, generatedAt: `${date}T06:00:00.000Z`, headline, summary: { added: 1, removed: 0, changed: 0, halts: 0, spot: 0, bstockCandidates: 0 } });
  let index = upsertIndex(null, make('2026-11-02', 'first'));
  index = upsertIndex(index, make('2026-11-03', 'second'));
  index = upsertIndex(index, make('2026-11-02', 'first <revised>'));
  assert.deepEqual(index.reports.map((item) => [item.date, item.headline]), [['2026-11-03', 'second'], ['2026-11-02', 'first <revised>']]);
  const rss = renderRss(index, 'https://example.test');
  assert.match(rss, /https:\/\/example\.test\/reports\?date=2026-11-03/);
  assert.match(rss, /first &lt;revised&gt;/);
});

function call(url) {
  return new Promise((resolve) => {
    const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { resolve({ status: this.status, headers: this.headers, body: String(body) }); } };
    handler({ method: 'GET', url, headers: { host: 'localhost' } }, response);
  });
}

test('report API serves the index, the latest report, and rejects bad dates', async () => {
  const index = JSON.parse((await call('/api/reports')).body);
  assert.ok(index.reports.length >= 1);
  const latest = await call('/api/daily-report');
  assert.equal(latest.status, 200);
  assert.equal(JSON.parse(latest.body).report.date, index.reports[0].date);
  assert.equal((await call('/api/daily-report?date=../catalog')).status, 400);
  assert.equal((await call('/api/daily-report?date=1999-01-01')).status, 404);
  const feed = await call('/api/reports/feed.xml');
  assert.match(feed.headers['content-type'], /rss/);
  assert.equal((await call('/reports')).status, 200);
});

test('reports publish automatically unless they look like an outage or mass change', async () => {
  const { reviewReasons } = await import('../daily-report.mjs');
  const report = (removed, extra = {}) => ({
    summary: { changed: 0, halts: 0, byProvider: { ondo: { live: 474 - removed, added: 0, removed }, bstock: { live: 46, added: 0, removed: 0 }, xstock: { live: 1417, added: 0, removed: 0 } }, ...extra },
    added: [],
  });
  assert.deepEqual(reviewReasons(report(0)), []);
  assert.deepEqual(reviewReasons(report(3)), []);
  assert.match(reviewReasons(report(12))[0], /Ondo: 12 tokens no longer listed/);
  assert.match(reviewReasons(report(0, { changed: 30 }))[0], /30 identity changes/);
  const odd = report(0);
  odd.added = [{ symbol: 'NEWon', onchain: { state: 'checked', symbol: 'OTHER' } }];
  assert.match(reviewReasons(odd)[0], /different onchain symbol/);
});
