// Daily change report: compares today's upstream provider observation with the
// previous one, and lists what is still waiting for catalog review.
// Observations are what providers published; the catalog only changes after review.

const PROVIDERS = ['ondo', 'bstock', 'xstock'];
export const PROVIDER_LABELS = { ondo: 'Ondo', bstock: 'bStocks', xstock: 'xStocks' };
const TRACKED = { ondo: ['symbol', 'ticker', 'name'], bstock: ['symbol', 'ticker', 'name'], xstock: ['symbol', 'ticker', 'name'] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function reportDate(isoTime) {
  const date = String(isoTime).slice(0, 10);
  if (!DATE.test(date)) throw new Error(`Invalid report time: ${isoTime}`);
  return date;
}

export function isReportDate(value) {
  return typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

// Build an observation from the approved catalog, used as the first baseline.
export function catalogObservation(catalog, spotCheck = null) {
  const observation = { observedAt: catalog.generatedAt, source: 'catalog', ondo: {}, bstock: {}, xstock: {}, bstockSource: 'catalog', spotPairs: {} };
  for (const record of catalog.records) {
    if (!PROVIDERS.includes(record.platformId)) continue;
    const entry = { symbol: record.symbol, ticker: record.underlyingTicker, name: record.issuerTokenName ?? record.tokenName };
    if (record.platformId === 'xstock') entry.halted = Boolean(record.tradingHalted);
    observation[record.platformId][record.contractAddress.toLowerCase()] = entry;
  }
  for (const pair of Object.values(spotCheck?.pairs ?? {})) observation.spotPairs[pair.baseAsset] = { status: pair.status, group: null };
  return observation;
}

const spotStatus = (entry) => (typeof entry === 'string' ? entry : entry?.status) ?? null;

// Unconfirmed bStocks: trading Binance Spot USDT pairs in the same Binance
// trading-permission group as the confirmed bStocks pairs, not yet in the catalog.
export function bstockSpotCandidates(spotPairs, knownBstockSymbols) {
  const groups = new Set(Object.entries(spotPairs)
    .filter(([base, entry]) => knownBstockSymbols.has(base) && entry?.group).map(([, entry]) => entry.group));
  return Object.entries(spotPairs)
    .filter(([base, entry]) => spotStatus(entry) === 'TRADING' && groups.has(entry?.group) && !knownBstockSymbols.has(base))
    .map(([base]) => ({ symbol: base, likelyTicker: base.slice(0, -1), pair: `${base}USDT` }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function diffProvider(provider, previous = {}, current = {}) {
  const added = [], removed = [], changed = [], halts = [];
  for (const [address, entry] of Object.entries(current)) {
    const before = previous[address];
    if (!before) { added.push({ provider, address, ...entry }); continue; }
    const fields = TRACKED[provider].filter((field) => String(before[field] ?? '').trim() !== String(entry[field] ?? '').trim())
      .map((field) => ({ field, from: before[field] ?? null, to: entry[field] ?? null }));
    if (fields.length) changed.push({ provider, address, symbol: entry.symbol, changes: fields });
    if (provider === 'xstock' && Boolean(before.halted) !== Boolean(entry.halted)) {
      halts.push({ provider, address, symbol: entry.symbol, ticker: entry.ticker, halted: Boolean(entry.halted) });
    }
  }
  for (const [address, entry] of Object.entries(previous)) {
    if (!current[address]) removed.push({ provider, address, ...entry });
  }
  const bySymbol = (a, b) => String(a.symbol).localeCompare(String(b.symbol));
  return { added: added.sort(bySymbol), removed: removed.sort(bySymbol), changed: changed.sort(bySymbol), halts: halts.sort(bySymbol) };
}

function diffSpot(previous = {}, current = {}, relevant) {
  const changes = [];
  for (const base of relevant) {
    const before = spotStatus(previous[base]);
    const after = spotStatus(current[base]);
    if (before !== after) changes.push({ base, pair: `${base}USDT`, from: before, to: after });
  }
  return changes.sort((a, b) => a.base.localeCompare(b.base));
}

export function compareObservations(previous, current, { skipBstock = false } = {}) {
  const result = { added: [], removed: [], changed: [], halts: [] };
  for (const provider of PROVIDERS) {
    // bStocks contracts are only confirmed from Binance RWA data. Without it,
    // the provider is reported as not checked instead of as removed.
    if (provider === 'bstock' && skipBstock) continue;
    const diff = diffProvider(provider, previous[provider], current[provider]);
    for (const key of Object.keys(result)) result[key].push(...diff[key]);
  }
  return result;
}

export function buildReport({ previous, current, catalog, previousReport = null, productUpdates = [], onchain = {} }) {
  const date = reportDate(current.observedAt);
  const bstockChecked = current.bstockSource === 'binance_rwa';
  const changes = compareObservations(previous, current, { skipBstock: !bstockChecked });
  for (const item of changes.added) item.onchain = onchain[item.address] ?? { state: 'not_checked' };

  const catalogState = catalogObservation(catalog);
  const pending = compareObservations(catalogState, current, { skipBstock: !bstockChecked });

  const knownBstock = new Set([...Object.values(catalogState.bstock), ...Object.values(current.bstock ?? {})].map((item) => item.symbol));
  const candidates = bstockChecked ? [] : bstockSpotCandidates(current.spotPairs ?? {}, knownBstock);
  const previousCandidates = new Set((previousReport?.bstockCandidates ?? []).map((item) => item.symbol));
  for (const item of candidates) item.new = !previousCandidates.has(item.symbol);

  const spot = diffSpot(previous.spotPairs, current.spotPairs, knownBstock);

  const since = previousReport?.date ?? null;
  const updates = productUpdates
    .filter((item) => isReportDate(item.date) && item.date <= date && (!since || item.date > since))
    .sort((a, b) => b.date.localeCompare(a.date));

  const count = (list, provider) => list.filter((item) => item.provider === provider).length;
  const summary = {
    added: changes.added.length, removed: changes.removed.length, changed: changes.changed.length,
    halts: changes.halts.length, spot: spot.length, bstockCandidates: candidates.filter((item) => item.new).length,
    byProvider: Object.fromEntries(PROVIDERS.map((provider) => [provider, {
      live: Object.keys(current[provider] ?? {}).length,
      added: count(changes.added, provider), removed: count(changes.removed, provider),
    }])),
    pendingReview: {
      added: pending.added.length, removed: pending.removed.length, changed: pending.changed.length, halts: pending.halts.length,
    },
  };

  return {
    schemaVersion: 1, date, generatedAt: current.observedAt,
    baseline: { since: previous.observedAt, kind: previous.source === 'catalog' ? 'catalog' : 'previous_report', previousReport: since },
    catalogSnapshotAt: catalog.generatedAt,
    bstockSource: bstockChecked ? 'binance_rwa' : 'not_checked',
    headline: headline(summary, changes, candidates),
    summary, ...changes, spot, bstockCandidates: candidates, productUpdates: updates,
  };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function headline(summary, changes, candidates) {
  const parts = [];
  if (summary.added) parts.push(`${plural(summary.added, 'new token')}`);
  if (summary.halts) {
    const halted = changes.halts.filter((item) => item.halted).length;
    const resumed = summary.halts - halted;
    if (halted) parts.push(`${halted} halted`);
    if (resumed) parts.push(`${resumed} resumed`);
  }
  if (summary.removed) parts.push(`${plural(summary.removed, 'token')} no longer listed`);
  if (summary.changed) parts.push(`${plural(summary.changed, 'identity change')}`);
  const fresh = candidates.filter((item) => item.new).length;
  if (fresh) parts.push(`${plural(fresh, 'possible bStocks listing')} on Binance Spot`);
  if (!parts.length) return 'No upstream changes since the last report.';
  const text = parts.join(', ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

export function reportIndexEntry(report) {
  return { date: report.date, generatedAt: report.generatedAt, headline: report.headline, summary: {
    added: report.summary.added, removed: report.summary.removed, changed: report.summary.changed,
    halts: report.summary.halts, spot: report.summary.spot, bstockCandidates: report.summary.bstockCandidates,
  } };
}

export function upsertIndex(index, report) {
  const entries = (index?.reports ?? []).filter((item) => item.date !== report.date);
  entries.push(reportIndexEntry(report));
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return { schemaVersion: 1, reports: entries };
}

function xml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

export function renderRss(index, siteUrl) {
  const items = (index?.reports ?? []).slice(0, 30).map((item) => {
    const link = `${siteUrl}/reports?date=${item.date}`;
    return `<item><title>${xml(`Mintmark daily report · ${item.date}`)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid><pubDate>${new Date(item.generatedAt).toUTCString()}</pubDate><description>${xml(item.headline)}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Mintmark daily report</title><link>${xml(`${siteUrl}/reports`)}</link><description>Daily changes to tokenized-stock identities on BNB Smart Chain across Ondo, bStocks, and xStocks.</description>${items}</channel></rss>\n`;
}

// A report publishes automatically unless it looks like a provider outage or a
// mass change, which a person should look at first.
export function reviewReasons(report, previousLive = {}) {
  const reasons = [];
  for (const [provider, counts] of Object.entries(report.summary.byProvider)) {
    const before = previousLive[provider] ?? counts.live + counts.removed - counts.added;
    if (counts.removed >= 10 || (before > 0 && counts.removed / before > 0.05)) {
      reasons.push(`${PROVIDER_LABELS[provider]}: ${counts.removed} tokens no longer listed`);
    }
  }
  if (report.summary.changed >= 25) reasons.push(`${report.summary.changed} identity changes in one day`);
  if (report.summary.halts >= 25) reasons.push(`${report.summary.halts} halt changes in one day`);
  const unreadable = report.added.filter((item) => item.onchain?.state === 'no_bytecode'
    || (item.onchain?.state === 'checked' && item.onchain.symbol !== item.symbol));
  if (unreadable.length) reasons.push(`${unreadable.length} new contract${unreadable.length === 1 ? '' : 's'} missing on BSC or with a different onchain symbol`);
  return reasons;
}
