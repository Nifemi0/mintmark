const target = document.querySelector('#report');
const archive = document.querySelector('#report-archive');
const providers = { ondo: 'Ondo', bstock: 'bStocks', xstock: 'xStocks' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function short(address) { return `${address.slice(0, 8)}…${address.slice(-6)}`; }
function day(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
function time(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}
function contract(address) {
  return `<a href="https://bscscan.com/token/${esc(address)}" target="_blank" rel="noopener noreferrer" title="${esc(address)}">${esc(short(address))}</a>`;
}
function onchain(item) {
  const check = item.onchain ?? {};
  if (check.state === 'checked') {
    return check.symbol === item.symbol
      ? '<span class="report-tag ok">Symbol matches onchain</span>'
      : `<span class="report-tag warn">Onchain symbol is ${esc(check.symbol)}</span>`;
  }
  if (check.state === 'no_bytecode') return '<span class="report-tag warn">No contract found on BSC</span>';
  return '<span class="report-tag">Onchain check not completed</span>';
}
function stat(value, label) { return `<div class="report-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`; }

function tokenRows(items, withCheck) {
  return `<div class="report-table" role="table">${items.map((item) => `<div class="report-row" role="row"><span role="cell"><strong>${esc(item.symbol)}</strong><small>${esc(item.ticker)}</small></span><span role="cell" class="report-name">${esc(item.name)}</span><span role="cell">${contract(item.address)}</span>${withCheck ? `<span role="cell">${onchain(item)}</span>` : ''}</div>`).join('')}</div>`;
}

function grouped(items, withCheck) {
  return Object.keys(providers).map((id) => {
    const list = items.filter((item) => item.provider === id);
    if (!list.length) return '';
    return `<details class="report-group" ${list.length <= 12 ? 'open' : ''}><summary><strong>${esc(providers[id])}</strong><span>${list.length} token${list.length === 1 ? '' : 's'}</span></summary>${tokenRows(list, withCheck)}</details>`;
  }).join('');
}

function section(kicker, title, body, note = '') {
  return `<section class="docs-section"><p class="docs-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2>${note ? `<p>${note}</p>` : ''}${body}</section>`;
}

function render(report) {
  const s = report.summary;
  const since = report.baseline.kind === 'catalog'
    ? `Compared with the reviewed registry snapshot of ${esc(time(report.baseline.since))}.`
    : `Compared with the previous report (${esc(report.baseline.previousReport ?? time(report.baseline.since))}).`;
  const parts = [`<section class="docs-hero"><p class="eyebrow">Mintmark daily report · ${esc(day(report.date))}</p><h1>${esc(report.headline)}</h1><p>${since} Observed ${esc(time(report.generatedAt))}.</p>
    <div class="report-stats">${stat(s.added, 'new tokens')}${stat(s.halts, 'halt changes')}${stat(s.removed, 'no longer listed')}${stat(s.changed, 'identity changes')}</div>
    <div class="report-providers">${Object.keys(providers).map((id) => `<span><strong>${esc(providers[id])}</strong>${id === 'bstock' && report.bstockSource !== 'binance_rwa' ? 'contracts not checked today' : `${esc(s.byProvider[id].live.toLocaleString())} live on BSC`}</span>`).join('')}</div></section>`];

  if (report.halts.length) {
    parts.push(section('Trading status', 'Halts and resumes', `<div class="report-table" role="table">${report.halts.map((item) => `<div class="report-row" role="row"><span role="cell"><strong>${esc(item.symbol)}</strong><small>${esc(item.ticker)}</small></span><span role="cell"><span class="report-tag ${item.halted ? 'warn' : 'ok'}">${item.halted ? 'Now marked halted' : 'Halt lifted'}</span></span><span role="cell">${contract(item.address)}</span></div>`).join('')}</div>`,
      'As published by the xStocks asset API. A halt is the provider\'s own status, not a Mintmark judgement.'));
  }
  if (report.added.length) {
    parts.push(section('New listings', `${s.added} new token${s.added === 1 ? '' : 's'}`, grouped(report.added, true),
      'Published by the provider with a BSC contract. Mintmark read each contract\'s symbol from BNB Chain and compares it with the published one.'));
  }
  if (report.removed.length) {
    parts.push(section('Removed', 'No longer in the provider list', grouped(report.removed, false),
      'Absence from a provider list does not prove the token was retired.'));
  }
  if (report.changed.length) {
    parts.push(section('Changes', 'Identity changes', `<div class="report-table" role="table">${report.changed.map((item) => `<div class="report-row" role="row"><span role="cell"><strong>${esc(item.symbol)}</strong><small>${esc(providers[item.provider])}</small></span><span role="cell" class="report-name">${item.changes.map((c) => `${esc(c.field)}: “${esc(c.from)}” → “${esc(c.to)}”`).join('<br>')}</span><span role="cell">${contract(item.address)}</span></div>`).join('')}</div>`));
  }
  if (report.spot.length) {
    parts.push(section('Venues', 'Binance Spot pair changes', `<div class="report-table" role="table">${report.spot.map((item) => `<div class="report-row" role="row"><span role="cell"><strong>${esc(item.pair)}</strong></span><span role="cell" class="report-name">${esc(item.from ?? 'not listed')} → ${esc(item.to ?? 'not listed')}</span></div>`).join('')}</div>`));
  }
  if (report.bstockCandidates.length) {
    const fresh = report.bstockCandidates.filter((item) => item.new);
    const list = fresh.length ? fresh : report.bstockCandidates;
    parts.push(section('Unconfirmed', `${report.bstockCandidates.length} possible bStocks listing${report.bstockCandidates.length === 1 ? '' : 's'}`,
      `<div class="report-chips">${list.map((item) => `<a href="https://data-api.binance.vision/api/v3/exchangeInfo?symbol=${esc(item.pair)}" target="_blank" rel="noopener noreferrer">${esc(item.symbol)}</a>`).join('')}</div>`,
      'These pairs trade on Binance Spot in the same trading group as confirmed bStocks, but Mintmark has not yet confirmed a BSC contract for them. They are not registry records.'));
  }
  if (!report.added.length && !report.removed.length && !report.changed.length && !report.halts.length && !report.spot.length) {
    parts.push(section('Summary', 'Nothing changed upstream', '', 'Every provider list matched the previous report.'));
  }
  const pending = s.pendingReview;
  const pendingTotal = pending.added + pending.removed + pending.changed + pending.halts;
  parts.push(section('Registry review', pendingTotal ? `${pendingTotal} change${pendingTotal === 1 ? '' : 's'} waiting for registry review` : 'Registry is up to date',
    '', pendingTotal
      ? `The registry was last reviewed ${esc(time(report.catalogSnapshotAt))}. ${pending.added} new, ${pending.removed} removed, ${pending.changed} changed and ${pending.halts} halt update${pending.halts === 1 ? '' : 's'} are not in registry records yet.`
      : 'Every upstream change in this report is already reflected in registry records.'));
  if (report.productUpdates.length) {
    parts.push(section('Mintmark updates', 'New in Mintmark', `<div class="report-updates">${report.productUpdates.map((item) => `<article><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></article>`).join('')}</div>`));
  }
  target.innerHTML = parts.join('');
  document.title = `Daily report ${report.date} — Mintmark`;
}

async function load() {
  const requested = new URLSearchParams(location.search).get('date');
  try {
    const [indexResponse, reportResponse] = await Promise.all([
      fetch('/api/reports'), fetch(`/api/daily-report${requested ? `?date=${encodeURIComponent(requested)}` : ''}`),
    ]);
    const index = await indexResponse.json();
    const payload = await reportResponse.json();
    archive.innerHTML = (index.reports ?? []).map((item) => `<a href="/reports?date=${esc(item.date)}"${item.date === payload.report?.date ? ' aria-current="page"' : ''}>${esc(item.date)}</a>`).join('') || '<span>No reports yet</span>';
    if (!reportResponse.ok) throw new Error(payload.error || 'Report unavailable');
    render(payload.report);
  } catch (error) {
    document.querySelector('#report-status').textContent = `The report could not be loaded: ${error.message}`;
  }
}
load();
