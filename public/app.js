const grid = document.querySelector('#record-grid');
const directoryQuery = document.querySelector('#directory-query');
const heroQuery = document.querySelector('#hero-query');
const searchMessage = document.querySelector('#search-message');
const apiStatus = document.querySelector('#api-status');
const snapshotStatus = document.querySelector('#snapshot-status');
const recordPlaceholder = document.querySelector('#record-placeholder');
const recordContent = document.querySelector('#record-content');
const recordDialog = document.querySelector('#record');
const categoryGrid = document.querySelector('#category-grid');
const providerComparison = document.querySelector('#provider-comparison');
const loadMore = document.querySelector('#load-more');
const walletForm = document.querySelector('#wallet-form');
const walletAddress = document.querySelector('#wallet-address');
const walletResult = document.querySelector('#wallet-result');
let allRecords = [];
let selectedKey = null;
let selectedCategory = 'All';
let visibleLimit = 9;
let currentResults = [];
let lastQuery = '';
let requestId = 0;
let walletRequestId = 0;
let recordRequestId = 0;
const categoryOrder = ['ondo', 'bstock', 'xstock'];
const providerLabels = { ondo: 'Ondo', bstock: 'bStocks', xstock: 'xStocks' };
const binanceReferralUrl = 'https://www.binance.com/activity/referral-entry/CPA/together-v4?hl=en&ref=CPA_00BHOH4O1Y&utm_source=Lite_web_account';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function icon(name, className = '') {
  return `<svg class="ui-icon${className ? ` ${className}` : ''}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

function shortAddress(value) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function logoContent(ticker, logoUrl = '') {
  const fallback = safeLogo(logoUrl);
  return `<span class="stock-logo-fallback">${escapeHtml(ticker[0] || '?')}</span><img class="stock-logo" src="/logos/${encodeURIComponent(ticker)}.png" data-fallback-src="${escapeHtml(fallback || '')}" alt="" loading="lazy">`;
}

function logoHtml(ticker, className = '', logoUrl = '') {
  return `<span class="stock-badge ${className}" aria-hidden="true">${logoContent(ticker, logoUrl)}</span>`;
}

function safeLogo(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['cdn.ondo.finance', 'onchainos.bnbstatic.com', 'xstocks-metadata.backed.fi'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement && event.target.classList.contains('stock-logo')) {
    const fallback = event.target.dataset.fallbackSrc;
    if (fallback) {
      event.target.dataset.fallbackSrc = '';
      event.target.src = fallback;
    } else event.target.remove();
  }
}, true);

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'date unavailable' : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function safeLink(url) {
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
}

function kindLabel(kind) {
  return ({ onchain_observed: 'Onchain observed', issuer_published: 'Issuer published', third_party_reported: 'Third-party report', unverified: 'Unverified' })[kind] || 'Unknown';
}

function money(value, compact = false) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return 'Not available';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: compact ? 2 : 2, notation: compact ? 'compact' : 'standard' }).format(number);
}

function quantity(value) {
  const number = Number(value);
  return value == null || !Number.isFinite(number) ? 'Not available' : new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(number);
}

function percentage(value) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return 'Not available';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function tokenBalance(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(number);
}

function renderWallet(wallet) {
  const holdings = wallet.supported ?? [];
  const source = safeLink(wallet.sourceUrl);
  const cards = holdings.map((holding) => `<button type="button" class="wallet-holding" data-wallet-key="${escapeHtml(holding.key)}" aria-label="Open ${escapeHtml(holding.companyName)} record">${logoHtml(holding.underlyingTicker, 'wallet-holding-mark')}<span><strong>${escapeHtml(holding.companyName)}</strong><small>${escapeHtml(holding.tokenSymbol)} · ${escapeHtml(shortAddress(holding.contractAddress))}</small></span><span class="wallet-holding-balance">${escapeHtml(tokenBalance(holding.balance))}<small>tokens held</small></span>${icon('arrow-up-right')}</button>`).join('');
  return `<div class="wallet-result-head"><div><strong>${holdings.length ? `${holdings.length} supported holding${holdings.length === 1 ? '' : 's'} found` : 'No supported holdings found'}</strong><p>${escapeHtml(shortAddress(wallet.address))} · checked ${escapeHtml(dateLabel(wallet.observedAt))}</p></div><span>BNB Smart Chain</span></div>
    ${cards || '<p class="wallet-empty">This address has no positive balance in the 24 contracts Mintmark currently checks. It may hold other assets; this lookup does not scan them.</p>'}
    <p class="wallet-note">Matched by exact BSC contract address, not symbol. Balances are third-party reported and may change. Other wallet tokens are not scanned or identified.${source ? ` <a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Wallet API source ${icon('arrow-up-right')}</a>` : ''}</p>`;
}

async function lookupWallet(address) {
  const current = ++walletRequestId;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    walletResult.innerHTML = '<div class="wallet-error">Enter a complete 0x BSC wallet address.</div>';
    return;
  }
  walletResult.innerHTML = '<div class="report-loading">Checking supported BSC contracts…</div>';
  try {
    const response = await fetch(`/api/wallet?address=${encodeURIComponent(address)}`);
    const payload = await response.json();
    if (response.status === 503 && payload.code === 'live_data_not_configured') {
      if (current === walletRequestId) walletResult.innerHTML = '<div class="report-unavailable">Live wallet lookup is not enabled on this demo yet. You can still search the registry by company or exact contract.</div>';
      return;
    }
    if (!response.ok) throw new Error(payload.error || 'Wallet lookup failed');
    if (current === walletRequestId) walletResult.innerHTML = renderWallet(payload.wallet);
  } catch (error) {
    if (current === walletRequestId) walletResult.innerHTML = `<div class="wallet-error">Wallet lookup unavailable: ${escapeHtml(error.message)}</div>`;
  }
}

function reportSource(source) {
  const link = safeLink(source.sourceUrl);
  return `<span class="report-source">${escapeHtml(kindLabel(source.sourceKind))} · retrieved ${escapeHtml(dateLabel(source.retrievedAt))}${link ? ` · <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Data source ${icon('arrow-up-right')}</a>` : ''}</span>`;
}

function tokenChart(movement) {
  const points = movement.points ?? [];
  if (points.length < 2) return '<p class="report-unavailable">Token price history is not available yet.</p>';
  const prices = points.map((point) => point.close);
  const min = Math.min(...prices), max = Math.max(...prices);
  const padding = Math.max((max - min) * .12, min * .005);
  const low = min - padding, high = max + padding;
  const coordinates = points.map((point, index) => `${(index / (points.length - 1) * 640).toFixed(1)},${(160 - (point.close - low) / (high - low) * 150).toFixed(1)}`).join(' ');
  const change = movement.changePct;
  const changeLabel = change == null ? 'Movement unavailable' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}% across ${points.length} daily closes`;
  return `<div class="chart-head"><strong>${escapeHtml(money(movement.lastClose))}</strong><span class="${change >= 0 ? 'positive' : 'negative'}">${escapeHtml(changeLabel)}</span></div><svg class="price-chart" viewBox="0 0 640 170" role="img" aria-label="BSC token daily closing prices from ${escapeHtml(dateLabel(movement.firstAt))} to ${escapeHtml(dateLabel(movement.lastAt))}"><line x1="0" y1="160" x2="640" y2="160"/><line x1="0" y1="85" x2="640" y2="85"/><line x1="0" y1="10" x2="640" y2="10"/><polyline points="${coordinates}"/></svg><div class="chart-dates"><span>${escapeHtml(dateLabel(movement.firstAt))}</span><span>${escapeHtml(dateLabel(movement.lastAt))}</span></div>`;
}

function tokenMarketPanel(market) {
  if (!market || market.availability !== 'reported') {
    return `<div class="report-token-market"><div class="report-subhead"><div><span class="report-label">Exact-contract market coverage</span><h5>Token market snapshot</h5></div></div><div class="report-unavailable">${escapeHtml(market?.notes?.[0] || 'Binance did not return market coverage for this exact contract.')}</div></div>`;
  }
  const liquidityLabel = market.liquidity == null ? 'Not reported' : Number(market.liquidity) === 0 ? '$0 reported' : money(market.liquidity, true);
  const notes = (market.notes ?? []).map((note) => `<p>${escapeHtml(note)}</p>`).join('');
  return `<div class="report-token-market"><div class="report-subhead"><div><span class="report-label">Exact-contract market coverage</span><h5>Token market snapshot</h5></div><p>${escapeHtml(market.description)}</p></div><div class="metric-grid market-metrics">
    <div class="metric"><span>Token price</span><strong>${escapeHtml(money(market.price))}</strong></div>
    <div class="metric"><span>Token change, 24h</span><strong>${escapeHtml(percentage(market.priceChange24H))}</strong></div>
    <div class="metric"><span>Reported volume, 24h</span><strong>${escapeHtml(money(market.volume24H, true))}</strong></div>
    <div class="metric"><span>Reported liquidity</span><strong>${escapeHtml(liquidityLabel)}</strong></div>
    <div class="metric"><span>Holders</span><strong>${escapeHtml(quantity(market.holders))}</strong></div>
    <div class="metric"><span>Transactions, 24h</span><strong>${escapeHtml(quantity(market.txs24H))}</strong></div>
  </div>${notes ? `<div class="market-quality-note"><strong>Coverage notes</strong>${notes}</div>` : ''}${reportSource(market)}<span class="market-observed">Provider observation ${escapeHtml(dateLabel(market.observedAt))}</span></div>`;
}

function renderCompanyReport(report) {
  const company = report.company, market = report.underlyingMarket, movement = report.tokenMovement;
  const tokenMarket = tokenMarketPanel(report.tokenMarket);
  if (report.availability === 'identity_only') {
    return `${tokenMarket}<div class="report-title report-title-secondary"><div><p class="eyebrow">Underlying company data</p><h4>Detailed company report unavailable</h4><p>${escapeHtml(company.name)} is identified by its xStocks listing and exact BSC contract. Mintmark has not verified a matching Binance RWA company profile or underlying-share report for this product.</p></div></div><div class="report-unavailable">Underlying company figures and the 30-day RWA candle series remain unavailable for this exact xStocks contract. Exact-contract token market coverage above is a separate Binance Market API report.${reportSource(company)}</div>`;
  }
  const website = safeLink(company.website);
  return `<div class="report-title"><div><p class="eyebrow">Public company data</p><h4>Company report</h4><p>Learn about the underlying business, then compare market data with the token record above.</p></div><span class="report-industry">${escapeHtml(company.industry || 'Industry unavailable')}</span></div>
    <div class="report-company"><div><span class="report-label">The business</span><div class="report-company-name">${logoHtml(company.ticker, 'report-company-mark')}<h5>${escapeHtml(company.name)}</h5></div><p>${escapeHtml(company.description || 'A sourced company description is not available.')}</p>${website ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Company website ${icon('arrow-up-right')}</a>` : ''}</div>${reportSource(company)}</div>
    <div class="report-market"><div class="report-subhead"><div><span class="report-label">Underlying share data</span><h5>Market snapshot</h5></div><p>Reference price is derived by the provider from the token price. It is not an official exchange quote.</p></div><div class="metric-grid">
      <div class="metric"><span>Reference price</span><strong>${escapeHtml(money(market.referencePrice))}</strong></div>
      <div class="metric"><span>Market cap</span><strong>${escapeHtml(money(market.marketCap, true))}</strong></div>
      <div class="metric"><span>52-week range</span><strong>${escapeHtml(money(market.low52W))} – ${escapeHtml(money(market.high52W))}</strong></div>
      <div class="metric"><span>Share volume, 24h</span><strong>${escapeHtml(quantity(market.volumeShares24H))}</strong></div>
      <div class="metric"><span>P/E, trailing 12 months</span><strong>${escapeHtml(market.peRatioTTM || 'Not available')}</strong></div>
      <div class="metric"><span>Price / book</span><strong>${escapeHtml(market.pbRatio || 'Not available')}</strong></div>
      <div class="metric"><span>Dividend yield</span><strong>${escapeHtml(market.dividendYield != null ? `${market.dividendYield}%` : 'Not available')}</strong></div>
      <div class="metric"><span>Latest dividend</span><strong>${escapeHtml(money(market.latestDividend))}</strong></div>
    </div>${reportSource(market)}</div>
    ${tokenMarket}<div class="report-token"><div class="report-subhead"><div><span class="report-label">BSC token price</span><h5>30-day movement</h5></div><p>${escapeHtml(movement.description)}</p></div>${tokenChart(movement)}${reportSource(movement)}</div>`;
}

async function loadCompanyReport(key) {
  const target = document.querySelector('#company-report');
  try {
    const response = await fetch(`/api/report?key=${encodeURIComponent(key)}`);
    const payload = await response.json();
    if (response.status === 503 && payload.code === 'live_data_not_configured') {
      if (selectedKey === key) target.innerHTML = '<div class="report-title"><div><p class="eyebrow">Live Binance data</p><h4>Live Binance report unavailable</h4><p>Binance restricted this deployment’s data requests, so exact-contract token-market and underlying-company figures cannot be shown here. The exact contract, issuer documents, and evidence above remain available.</p></div></div><div class="report-unavailable">No figures have been filled in from another token.</div>';
      return;
    }
    if (!response.ok) throw new Error(payload.error || 'Company report is unavailable');
    if (selectedKey === key) target.innerHTML = renderCompanyReport(payload.report);
  } catch (error) {
    if (selectedKey === key) target.innerHTML = `<div class="report-error">Company report unavailable: ${escapeHtml(error.message)}</div>`;
  }
}

function renderFeatured() {
  const record = allRecords.find((item) => item.underlyingTicker === 'AAPL' && item.platformId === 'ondo') || allRecords[0];
  if (!record) return;
  document.querySelector('#featured-contract').textContent = shortAddress(record.contractAddress);
  document.querySelector('#featured-company').textContent = record.companyName;
  document.querySelector('#featured-ticker').textContent = `UNDERLYING · ${record.underlyingTicker}`;
  document.querySelector('#featured-symbol').textContent = record.symbol;
  document.querySelector('#featured-issuer').textContent = `BNB CHAIN · ${record.issuer}`;
  document.querySelector('#featured-mark').innerHTML = logoContent(record.underlyingTicker, record.logoUrl);
}

function renderStatus(payload) {
  snapshotStatus.textContent = `${payload.total} BSC records · 3 providers · checked ${dateLabel(payload.snapshotAt)}`;
  const binance = payload.binance;
  apiStatus.className = 'api-status';
  if (binance.state === 'checked') {
    apiStatus.textContent = `Ondo, bStocks and xStocks contracts checked on BSC. Ondo identities cross-checked with Binance ${dateLabel(binance.observedAt)}. Open a record for its source.`;
  } else if (binance.state === 'not_configured') {
    apiStatus.classList.add('warning');
    apiStatus.textContent = 'Ondo, bStocks and xStocks contracts checked on BSC. Live Binance cross-check is pending developer credentials.';
  } else {
    apiStatus.classList.add('error');
    apiStatus.textContent = `Provider and BSC records are available. Live Binance cross-check failed: ${binance.detail}`;
  }
}

function renderCategories() {
  categoryGrid.innerHTML = categoryOrder.map((category) => {
    const matches = allRecords.filter((record) => record.platformId === category);
    if (!matches.length) return '';
    const examples = ['NVDA', 'TSLA', 'AAPL'].map((ticker) => matches.find((record) => record.underlyingTicker === ticker)).filter(Boolean).slice(0, 2).map((record) => record.companyName).join(' · ');
    return `<button type="button" class="category-card${selectedCategory === category ? ' active' : ''}" data-category="${escapeHtml(category)}" aria-pressed="${selectedCategory === category}"><span class="category-top"><strong>${escapeHtml(providerLabels[category])}</strong>${icon('arrow-up-right')}</span><span class="category-examples">${escapeHtml(examples)}</span><small>${matches.length} checked contracts</small></button>`;
  }).join('');
}

function comparisonSignals(record) {
  const hasOnchainIdentity = record.onchainIdentityObserved;
  const binanceState = record.binanceState;
  const binanceLinked = ['matched', 'name_difference', 'snapshot_source'].includes(binanceState);
  const reportReady = binanceLinked && record.platformId !== 'xstock';
  const signal = (label, value, state) => `<div class="product-signal"><span>${escapeHtml(label)}</span><strong class="${state}"><i aria-hidden="true"></i>${escapeHtml(value)}</strong></div>`;
  return `<div class="product-signals" aria-label="Available data">
    ${signal('Contract identity', hasOnchainIdentity ? 'Checked on BSC' : 'Needs review', hasOnchainIdentity ? 'available' : 'warning')}
    ${signal('Company report', reportReady ? 'Available' : 'Not available', reportReady ? 'available' : 'unavailable')}
    ${signal('Wallet lookup', record.walletLookupEnabled ? 'Supported' : 'Not included', record.walletLookupEnabled ? 'available' : 'unavailable')}
    ${signal('Market snapshot', 'Loads when opened', 'live')}
  </div>`;
}

function comparisonBrief(records) {
  const exactContracts = new Set(records.map((record) => record.contractAddress.toLowerCase())).size;
  const sourceDifferences = records.filter((record) => record.sourceConflict).length;
  return `<div class="comparison-guide"><div><span>What this means</span><strong>One company, ${exactContracts} separate token contracts.</strong><p>These products are issued separately and should not be treated as interchangeable. Choose a provider, confirm its contract, then open the full record.</p></div><ol aria-label="How to compare"><li><b>Choose an issuer</b><span>Each provider has its own terms.</span></li><li><b>Confirm the contract</b><span>The address identifies the token.</span></li><li><b>Open the record</b><span>Review evidence and live coverage.</span></li></ol>${sourceDifferences ? `<p class="comparison-guide-warning">${sourceDifferences} product has a source-name difference. It is clearly marked on its card.</p>` : ''}</div>`;
}

function renderComparison(records, query) {
  const tickers = new Set(records.map((record) => record.underlyingTicker));
  if (!query || selectedCategory !== 'All' || records.length < 2 || tickers.size !== 1) {
    providerComparison.hidden = true;
    providerComparison.innerHTML = '';
    return;
  }
  const ticker = records[0].underlyingTicker;
  const providers = new Set(records.map((record) => record.platformId));
  providerComparison.hidden = false;
  providerComparison.innerHTML = `<div class="comparison-heading"><div><p class="eyebrow">Compare provider products</p><h3>Choose a ${escapeHtml(ticker)} token product</h3><p>Each product represents the same public ticker, but has a different issuer, contract, terms, and data coverage.</p></div><div class="comparison-heading-actions"><span>${providers.size} provider${providers.size === 1 ? '' : 's'}</span><button type="button" data-share-query="${escapeHtml(ticker)}">Copy comparison link ${icon('link')}</button></div></div>${comparisonBrief(records)}
    <div class="comparison-cards">${records.map((record) => {
      const terms = safeLink(record.issuerTermsUrl);
      const explorer = `https://bscscan.com/token/${record.contractAddress}`;
      return `<article class="comparison-card"><div class="product-card-head"><div class="comparison-provider">${logoHtml(record.underlyingTicker, 'comparison-mark', record.logoUrl)}<span><strong>${escapeHtml(record.providerName)}</strong><small>${escapeHtml(record.issuer)}</small></span></div><span class="product-chain">BNB Chain</span></div><div class="product-symbol"><span>Token symbol</span><strong>${escapeHtml(record.symbol)}</strong></div><div class="product-contract"><span>Exact contract</span><a href="${escapeHtml(explorer)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(record.contractAddress)}">${escapeHtml(shortAddress(record.contractAddress))} ${icon('arrow-up-right')}</a></div>${comparisonSignals(record)}${record.sourceConflict ? `<div class="product-alert"><strong>Source-name difference</strong><span>${escapeHtml(record.sourceConflict)}</span></div>` : ''}<div class="product-card-actions"><button type="button" data-compare-key="${escapeHtml(record.key)}">View ${escapeHtml(record.symbol)} record ${icon('arrow-up-right')}</button>${terms ? `<a href="${escapeHtml(terms)}" target="_blank" rel="noopener noreferrer">Legal documents</a>` : '<span>Documents unavailable</span>'}${record.platformId === 'bstock' ? `<a class="affiliate-inline" href="${escapeHtml(binanceReferralUrl)}" target="_blank" rel="sponsored noopener noreferrer">Open Binance · affiliate</a>` : ''}</div></article>`;
    }).join('')}</div>`;
}

function renderCards(records, query) {
  if (!query && selectedCategory === 'All') {
    const examples = [
      records.find((record) => record.platformId === 'ondo' && record.underlyingTicker === 'AAPL'),
      records.find((record) => record.platformId === 'bstock' && record.underlyingTicker === 'NVDA'),
      records.find((record) => record.platformId === 'xstock' && record.underlyingTicker === 'NVDA'),
    ].filter(Boolean);
    const featuredKeys = new Set(examples.map((record) => record.key));
    records = [...examples, ...records.filter((record) => !featuredKeys.has(record.key))];
  }
  currentResults = records;
  lastQuery = query;
  renderComparison(records, query);
  const scope = selectedCategory === 'All' ? 'the full catalog' : providerLabels[selectedCategory];
  searchMessage.textContent = query
    ? `${records.length} record${records.length === 1 ? '' : 's'} for “${query}” in ${scope}`
    : `Showing ${Math.min(records.length, visibleLimit)} of ${records.length} checked records in ${scope}`;
  if (!records.length) {
    grid.hidden = false;
    const contract = query.trim().toLowerCase().startsWith('0x');
    grid.innerHTML = `<div class="empty-card"><strong>${contract ? 'No exact contract match.' : 'No matching record.'}</strong><p>${contract ? 'This BSC contract is not in Mintmark’s checked catalog. Browse companies above or try another exact address.' : 'Try a company or fund name, ticker, or another browse category.'}</p></div>`;
    loadMore.hidden = true;
    return;
  }
  if (!providerComparison.hidden) {
    grid.hidden = true;
    grid.innerHTML = '';
    loadMore.hidden = true;
    return;
  }
  grid.hidden = false;
  grid.innerHTML = records.slice(0, visibleLimit).map((record) => `<button class="record-card${record.key === selectedKey ? ' active' : ''}" type="button" data-key="${escapeHtml(record.key)}" aria-label="Open ${escapeHtml(record.symbol)} record for ${escapeHtml(record.companyName)}">
    <span class="card-top">${logoHtml(record.underlyingTicker, 'ticker-mark', record.logoUrl)}${icon('arrow-up-right', 'card-arrow')}</span>
    <span class="card-company">${escapeHtml(record.companyName)}</span><span class="card-symbol">${escapeHtml(record.symbol)} · ${escapeHtml(record.underlyingTicker)}</span>
    <span class="card-foot"><span>${escapeHtml(record.providerName)} · ${escapeHtml(record.category)}</span><span>${escapeHtml(shortAddress(record.contractAddress))}</span></span>
  </button>`).join('');
  loadMore.hidden = records.length <= visibleLimit;
  loadMore.innerHTML = `Show ${Math.min(9, records.length - visibleLimit)} more stocks ${icon('chevron-down')}`;
}

async function loadRecords(query = '') {
  const current = ++requestId;
  try {
    const response = await fetch(`/api/records?q=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Registry request failed');
    if (current !== requestId) return;
    if (!query) {
      allRecords = payload.records;
      renderCategories();
    }
    renderStatus(payload);
    visibleLimit = 9;
    renderCards(payload.records.filter((record) => selectedCategory === 'All' || record.platformId === selectedCategory), query);
    if (!query) renderFeatured();
  } catch (error) {
    if (current !== requestId) return;
    providerComparison.hidden = true;
    grid.innerHTML = `<div class="empty-card"><strong>Registry unavailable.</strong><p>${escapeHtml(error.message)}</p></div>`;
    searchMessage.textContent = '';
  }
}

function evidenceHtml(item) {
  const source = safeLink(item.sourceUrl);
  const link = source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(item.sourceLabel)} ${icon('arrow-up-right')}</a>` : `<span>${escapeHtml(item.sourceLabel)}</span>`;
  const explanation = {
    onchain_observed: 'Read from the BSC contract at check time. This does not establish share backing or legal rights.',
    issuer_published: 'Published by the issuer. Mintmark links the statement but does not independently verify offchain backing.',
    third_party_reported: 'Reported by an external data provider and shown with its source and retrieval time.',
    unverified: 'Mintmark has not verified this claim with an external source.',
  }[item.kind] ?? 'Evidence details are unavailable.';
  return `<details class="evidence-row"><summary><span class="evidence-kind ${escapeHtml(item.kind)}">${escapeHtml(kindLabel(item.kind))}</span><span class="evidence-claim"><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.field)} · checked ${escapeHtml(dateLabel(item.observedAt))}</small></span>${icon('chevron-down', 'evidence-expand')}</summary><div class="evidence-detail"><p>${escapeHtml(explanation)}</p>${link}</div></details>`;
}

function renderRecordHistory(payload) {
  const latest = payload.entries.at(-1);
  const items = [...payload.entries].reverse().map((entry) => {
    const source = safeLink(entry.sourceUrl);
    const changes = entry.kind === 'added'
      ? '<p>First checked registry snapshot for this exact contract.</p>'
      : entry.kind === 'removed_from_catalog'
        ? '<p>Removed from the current curated catalog. This does not prove the issuer retired the token.</p>'
        : entry.changes.length
          ? `<ul>${entry.changes.map((change) => `<li><strong>${escapeHtml(change.field)}</strong>: ${escapeHtml(change.from ?? 'not listed')} ${icon('arrow-right', 'inline-icon')} ${escapeHtml(change.to ?? 'not listed')}</li>`).join('')}</ul>`
          : '<p>Returned to the curated catalog.</p>';
    const reviewMethod = entry.reviewMethod.replace('Ondo published list', 'provider-published identity');
    return `<div class="history-entry"><div><strong>Version ${escapeHtml(entry.version)} · ${escapeHtml(entry.kind.replaceAll('_', ' '))}</strong><span>${escapeHtml(dateLabel(entry.observedAt))}</span></div>${changes}<small>${escapeHtml(reviewMethod)}${source ? ` · <a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Source ${icon('arrow-up-right')}</a>` : ''}</small></div>`;
  }).join('');
  return `<div class="history-title"><div><p class="eyebrow">Public record history</p><h4>What changed in this record</h4></div><span>Current version ${escapeHtml(latest?.version ?? '—')}</span></div>${payload.unresolved.map((item) => `<div class="history-unresolved">Unresolved ${escapeHtml(item.source)} difference: ${escapeHtml(item.detail)}</div>`).join('')}<div class="history-entries">${items}</div>`;
}

async function loadRecordHistory(key) {
  const target = document.querySelector('#record-history');
  try {
    const response = await fetch(`/api/history?key=${encodeURIComponent(key)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Record history is unavailable');
    if (selectedKey === key) target.innerHTML = renderRecordHistory(payload);
  } catch (error) {
    if (selectedKey === key) target.innerHTML = `<div class="report-error">Record history unavailable: ${escapeHtml(error.message)}</div>`;
  }
}

async function openRecord(key) {
  const current = ++recordRequestId;
  recordPlaceholder.querySelector('p').textContent = 'Loading the exact token record…';
  recordPlaceholder.hidden = false;
  recordContent.hidden = true;
  if (!recordDialog.open) recordDialog.showModal();
  recordDialog.scrollTop = 0;
  try {
    const response = await fetch(`/api/record?key=${encodeURIComponent(key)}`);
    const payload = await response.json();
    if (current !== recordRequestId || !recordDialog.open) return;
    if (!response.ok) throw new Error(payload.error || 'Could not open record');
    const record = payload.record;
    selectedKey = record.key;
    const sourceUrl = safeLink(record.issuerAssetUrl);
    const explorerUrl = safeLink(record.explorerUrl);
    recordContent.innerHTML = `<div class="detail-head"><div><p class="eyebrow">${escapeHtml(providerLabels[record.platformId] || record.platformId)} · ${escapeHtml(record.symbol)} · BNB Smart Chain · version ${escapeHtml(record.recordVersion ?? 1)}</p><h3>${escapeHtml(record.companyName)}</h3><p>Exact identity: ${escapeHtml(record.key)}</p><a class="compare-company-link" href="/?q=${encodeURIComponent(record.underlyingTicker)}#registry">Compare every ${escapeHtml(record.underlyingTicker)} product ${icon('arrow-up-right')}</a></div>${logoHtml(record.underlyingTicker, 'detail-mark', record.logoUrl)}</div>
      <div class="detail-body"><div class="identity-facts">
        <div class="fact"><label>Token symbol</label><strong>${escapeHtml(record.symbol)}</strong></div>
        <div class="fact"><label>Underlying ticker</label><strong>${escapeHtml(record.underlyingTicker)}</strong></div>
        ${record.platformId === 'xstock' ? `<div class="fact"><label>xStocks catalog status</label><strong>${record.tradingHalted ? 'Marked trading halted' : 'Not marked halted'}</strong></div>` : ''}
        <div class="fact"><label>Provider</label><strong>${escapeHtml(providerLabels[record.platformId] || record.platformId)}</strong></div>
        <div class="fact"><label>Issuer</label><strong>${escapeHtml(record.issuer)}</strong>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Provider asset record ${icon('arrow-up-right')}</a>` : ''}${safeLink(record.issuerTermsUrl) ? `<a href="${escapeHtml(record.issuerTermsUrl)}" target="_blank" rel="noopener noreferrer">Legal documents ${icon('arrow-up-right')}</a>` : ''}</div>
        <div class="fact"><label>Chain</label><strong>BNB Smart Chain · 56</strong></div>
        <div class="fact"><label>Exact contract</label><code>${escapeHtml(record.contractAddress)}</code>${explorerUrl ? `<a href="${escapeHtml(explorerUrl)}" target="_blank" rel="noopener noreferrer">Open BscScan ${icon('arrow-up-right')}</a>` : ''}</div>
        <div class="fact"><label>Last checked</label><strong>${escapeHtml(dateLabel(record.observedAt))}</strong></div>
      </div><div class="evidence-panel"><h4>Evidence for this record</h4><p>Open a claim to see its source and limits. An issuer publication and an onchain observation answer different questions.</p>${record.evidence.map(evidenceHtml).join('')}</div></div>
      ${record.sourceConflict ? `<div class="cross-check conflict"><strong>Provider listing and onchain name differ</strong><p>${escapeHtml(record.sourceConflict)}</p><small>Compare the provider listing and BSC contract evidence above.</small></div>` : ''}
      ${record.binanceCheck ? `<div class="cross-check ${escapeHtml(record.binanceCheck.state)}"><strong>Binance RWA cross-check · ${escapeHtml(record.binanceCheck.state.replace('_', ' '))}</strong><p>${escapeHtml(record.binanceCheck.detail)}</p><small>Third-party reported · checked ${escapeHtml(dateLabel(record.binanceCheck.observedAt))} · <a href="https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data" target="_blank" rel="noopener noreferrer">API source and field definitions ${icon('arrow-up-right')}</a></small></div>` : ''}
      ${record.platformId === 'bstock' ? `<div class="record-affiliate"><div><strong>Continue with Binance</strong><p>Open Binance through the builder’s referral link. This does not establish availability or liquidity for ${escapeHtml(record.symbol)} in your region.</p><small>Affiliate disclosure: the Mintmark builder may receive a reward from eligible activity.</small></div><a href="${escapeHtml(binanceReferralUrl)}" target="_blank" rel="sponsored noopener noreferrer">Open Binance ${icon('arrow-up-right')}</a></div>` : ''}
      <section id="record-history" class="record-history" aria-label="Record history"><div class="report-loading">Loading record history…</div></section>
      <section id="company-report" class="company-report" aria-label="Company report"><div class="report-loading">Loading sourced company and market data…</div></section>`;
    recordPlaceholder.hidden = true;
    recordContent.hidden = false;
    document.querySelectorAll('.record-card').forEach((card) => card.classList.toggle('active', card.dataset.key === key));
    const recordUrl = new URL(location.href);
    recordUrl.searchParams.set('record', record.key);
    if (lastQuery) recordUrl.searchParams.set('q', lastQuery); else recordUrl.searchParams.delete('q');
    recordUrl.hash = 'record';
    history.replaceState(null, '', `${recordUrl.pathname}${recordUrl.search}${recordUrl.hash}`);
    loadRecordHistory(record.key);
    loadCompanyReport(record.key);
  } catch (error) {
    if (current !== recordRequestId || !recordDialog.open) return;
    recordPlaceholder.hidden = false;
    recordContent.hidden = true;
    recordPlaceholder.querySelector('p').textContent = error.message;
  }
}

document.querySelector('#record-close').addEventListener('click', () => recordDialog.close());
recordDialog.addEventListener('close', () => {
  recordRequestId++;
  selectedKey = null;
  document.querySelectorAll('.record-card').forEach((card) => card.classList.remove('active'));
  const url = new URL(location.href);
  url.searchParams.delete('record');
  url.hash = '';
  history.replaceState(null, '', `${url.pathname}${url.search}`);
});

grid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-key]');
  if (card) openRecord(card.dataset.key);
});

providerComparison.addEventListener('click', (event) => {
  const button = event.target.closest('[data-compare-key]');
  if (button) openRecord(button.dataset.compareKey);
  const share = event.target.closest('[data-share-query]');
  if (share) {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set('q', share.dataset.shareQuery);
    url.hash = 'registry';
    navigator.clipboard.writeText(url.href).then(() => {
      share.innerHTML = `Link copied ${icon('link')}`;
      setTimeout(() => { share.innerHTML = `Copy comparison link ${icon('link')}`; }, 1800);
    }).catch(() => { location.href = url.href; });
  }
});

function syncSearchUrl(query) {
  const url = new URL(location.href);
  url.searchParams.delete('record');
  if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
  url.hash = query ? 'registry' : '';
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

walletForm.addEventListener('submit', (event) => {
  event.preventDefault();
  lookupWallet(walletAddress.value.trim());
});

document.querySelector('#wallet-example').addEventListener('click', () => {
  walletAddress.value = '0x73d8bd54f7cf5fab43fe4ef40a62d390644946db';
  lookupWallet(walletAddress.value);
});

walletResult.addEventListener('click', (event) => {
  const holding = event.target.closest('[data-wallet-key]');
  if (holding) openRecord(holding.dataset.walletKey);
});

categoryGrid.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-category]');
  if (!card) return;
  selectedCategory = card.dataset.category;
  renderCategories();
  await loadRecords(directoryQuery.value.trim());
  document.querySelector('#record-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('#browse-all').addEventListener('click', async () => {
  selectedCategory = 'All';
  directoryQuery.value = '';
  heroQuery.value = '';
  syncSearchUrl('');
  await loadRecords();
  document.querySelector('#record-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

loadMore.addEventListener('click', () => {
  visibleLimit += 9;
  renderCards(currentResults, lastQuery);
});

document.querySelector('#hero-search').addEventListener('submit', (event) => {
  event.preventDefault();
  selectedCategory = 'All';
  renderCategories();
  directoryQuery.value = heroQuery.value.trim();
  syncSearchUrl(directoryQuery.value);
  loadRecords(directoryQuery.value);
  document.querySelector('#registry').scrollIntoView({ behavior: 'smooth' });
});

let searchTimer;
directoryQuery.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = directoryQuery.value.trim();
    heroQuery.value = query;
    syncSearchUrl(query);
    loadRecords(query);
  }, 180);
});

const initialParams = new URLSearchParams(location.search);
const initialQuery = (initialParams.get('q') || '').slice(0, 120);
directoryQuery.value = initialQuery;
heroQuery.value = initialQuery;
await loadRecords(initialQuery);
const directKey = initialParams.get('record');
if (directKey) await openRecord(directKey);
