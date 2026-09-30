import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const debugBase = 'http://127.0.0.1:9227';
const targetUrl = process.env.MINTMARK_QA_URL ?? 'https://mintmark.nuvixes.studio/';
const targets = await fetch(`${debugBase}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(targetUrl));
if (!target) throw new Error('Mintmark Chrome target was not found');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];
const failedRequests = [];
const badResponses = [];

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
    failedRequests.push({ url: message.params.requestId, error: message.params.errorText });
  }
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
    badResponses.push({ status: message.params.response.status, url: message.params.response.url });
  }
});

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function pointFor(selector, matchingText = null) {
  const args = JSON.stringify({ selector, matchingText });
  return evaluate(`(async () => {
    const { selector, matchingText } = ${args};
    const items = [...document.querySelectorAll(selector)];
    const element = matchingText ? items.find((item) => item.textContent.includes(matchingText)) : items[0];
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
}

async function click(selector, matchingText = null) {
  const point = await pointFor(selector, matchingText);
  if (!point) throw new Error(`Could not click ${selector}${matchingText ? ` containing ${matchingText}` : ''}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function domClick(selector, matchingText = null) {
  const args = JSON.stringify({ selector, matchingText });
  const clicked = await evaluate(`(() => {
    const { selector, matchingText } = ${args};
    const items = [...document.querySelectorAll(selector)];
    const element = matchingText ? items.find((item) => item.textContent.includes(matchingText)) : items[0];
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click ${selector}${matchingText ? ` containing ${matchingText}` : ''}`);
}

async function fill(selector, text) {
  await click(selector);
  const encodedSelector = JSON.stringify(selector);
  await evaluate(`(() => {
    const element = document.querySelector(${encodedSelector});
    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await send('Input.insertText', { text });
}

async function press(key, code = key) {
  const keyCode = key === 'Escape' ? 27 : key === 'Enter' ? 13 : undefined;
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function screenshot(filename) {
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(process.cwd(), 'docs', filename), Buffer.from(result.data, 'base64'));
}

await Promise.all([
  send('Page.enable'), send('Runtime.enable'), send('Network.enable'), send('Log.enable'),
]);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: targetUrl });
await waitFor(`document.readyState === 'complete' && document.querySelectorAll('.record-card').length > 0`);

const results = {};
results.initial = await evaluate(`({
  title: document.title,
  cards: document.querySelectorAll('.record-card').length,
  heroVisible: document.querySelector('.hero-search').getBoundingClientRect().top < innerHeight,
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  apiStatus: document.querySelector('#api-status').textContent.trim(),
})`);
await screenshot('qa-production-desktop-home.png');

await fill('#hero-query', 'NVIDIA');
await click('#hero-search button[type="submit"]');
await waitFor(`document.querySelectorAll('.record-card').length === 3 && document.querySelector('#search-message').textContent.includes('3')`);
results.nvidiaSearch = await evaluate(`({
  cards: document.querySelectorAll('.record-card').length,
  symbols: [...document.querySelectorAll('.record-card')].map((card) => card.textContent.match(/NVDA(?:on|B|x)/)?.[0]).filter(Boolean),
  comparisonVisible: !document.querySelector('#provider-comparison').hidden,
})`);

await domClick('.record-card', 'NVDAon');
await waitFor(`document.querySelector('#record')?.open && document.querySelector('#company-report') && !document.querySelector('#company-report').textContent.includes('Loading')`);
results.ondoReport = await evaluate(`({
  dialogOpen: document.querySelector('#record').open,
  heading: document.querySelector('#record-heading').textContent.trim(),
  companyReport: document.querySelector('#company-report').textContent.includes('NVIDIA'),
  marketCap: document.querySelector('#company-report').textContent.includes('Market cap'),
  history: document.querySelector('#record-history').textContent.includes('Current version'),
  evidenceRows: document.querySelectorAll('.evidence-row').length,
  urlHasRecord: location.search.includes('record='),
})`);
await domClick('.evidence-row summary');
results.evidence = await evaluate(`({
  expanded: document.querySelector('.evidence-row').open,
  hasSourceLink: Boolean(document.querySelector('.evidence-row a[href]')),
})`);
await screenshot('qa-production-desktop-report.png');
await press('Escape');
await waitFor(`!document.querySelector('#record').open && !location.search.includes('record=')`);
results.dialogClose = await evaluate(`({ closed: !document.querySelector('#record').open, cleanUrl: !location.search.includes('record=') })`);

for (const [query, expected] of [['TSLA', 3], ['AAPL', 2], ['0xa9ee28c80f960b889dfbd1902055218cba016f75', 1]]) {
  await fill('#directory-query', query);
  await waitFor(`document.querySelectorAll('.record-card').length === ${expected} && document.querySelector('#search-message').textContent.includes(${JSON.stringify(query)})`);
  results[`search_${query.slice(0, 8)}`] = await evaluate(`({ cards: document.querySelectorAll('.record-card').length, message: document.querySelector('#search-message').textContent.trim() })`);
}

await fill('#directory-query', 'NVIDIA');
await waitFor(`document.querySelectorAll('.record-card').length === 3`);
await domClick('.record-card', 'NVDAx');
await waitFor(`document.querySelector('#record')?.open && document.querySelector('#company-report')?.textContent.includes('Detailed report unavailable')`);
results.xstocks = await evaluate(`({
  explicitUnavailable: document.querySelector('#company-report').textContent.includes('Detailed report unavailable'),
  noBorrowedFigures: document.querySelector('#company-report').textContent.includes('unavailable for this exact xStocks contract'),
})`);
await press('Escape');

await fill('#wallet-address', '0x123');
await domClick('#wallet-form button[type="submit"]');
await waitFor(`document.querySelector('#wallet-result').textContent.includes('complete 0x')`);
results.invalidWallet = await evaluate(`document.querySelector('#wallet-result').textContent.trim()`);
await domClick('#wallet-example');
await waitFor(`document.querySelector('#wallet-result').textContent.includes('supported holding') || document.querySelector('#wallet-result').textContent.includes('No supported holdings')`, 20000);
results.walletExample = await evaluate(`({ text: document.querySelector('#wallet-result').textContent.trim().slice(0, 240), error: document.querySelector('#wallet-result').classList.contains('report-error') })`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Page.navigate', { url: targetUrl });
await waitFor(`document.readyState === 'complete' && document.querySelectorAll('.record-card').length > 0`);
results.mobileInitial = await evaluate(`({
  width: innerWidth,
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  heroSearchVisible: document.querySelector('.hero-search').getBoundingClientRect().top < innerHeight,
  headerActionVisible: getComputedStyle(document.querySelector('.header-action')).display !== 'none',
})`);
await screenshot('qa-production-mobile-home.png');
await fill('#hero-query', 'NVIDIA');
await click('#hero-search button[type="submit"]');
await waitFor(`document.querySelectorAll('.record-card').length === 3`);
await domClick('.record-card', 'NVDAB');
await waitFor(`document.querySelector('#record')?.open && document.querySelector('#company-report') && !document.querySelector('#company-report').textContent.includes('Loading')`);
results.mobileReport = await evaluate(`(() => {
  const dialog = document.querySelector('#record').getBoundingClientRect();
  return {
    reportLoaded: document.querySelector('#company-report').textContent.includes('Nvidia Corp'),
    dialogBounds: { left: dialog.left, right: dialog.right, width: dialog.width, viewport: innerWidth },
    dialogWithinViewport: dialog.left >= -1 && dialog.right <= innerWidth + 1,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})()`);
await screenshot('qa-production-mobile-report.png');

results.images = await evaluate(`({
  total: document.images.length,
  broken: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
})`);
results.errors = { consoleErrors, exceptions, failedRequests, badResponses };

console.log(JSON.stringify(results, null, 2));
socket.close();
