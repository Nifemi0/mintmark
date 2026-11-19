import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler from '../api/index.mjs';
import { createRateLimiter, lookupTokens, tokenView } from '../api-v1.mjs';

const NVDAON = '0xa9ee28c80f960b889dfbd1902055218cba016f75';
let ip = 0;

function call(method, url, body, headers = {}) {
  return new Promise((resolve) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
    Object.assign(request, { method, url, headers: { host: 'localhost', 'x-forwarded-for': `10.0.0.${++ip}`, ...headers } });
    const response = {
      headers: {}, setHeader(k, v) { this.headers[k] = v; },
      writeHead(status, h) { this.status = status; Object.assign(this.headers, h); },
      end(data = '') { resolve({ status: this.status, headers: this.headers, body: data ? JSON.parse(String(data)) : null }); },
    };
    handler(request, response);
  });
}

test('v1 token lookup by exact contract returns the stable token shape', async () => {
  const res = await call('GET', `/v1/tokens/56/${NVDAON.toUpperCase().replace('0X', '0x')}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], '*');
  assert.match(res.headers['cache-control'], /s-maxage=300/);
  assert.equal(res.headers['x-mintmark-api-version'], '1');
  const token = res.body.token;
  assert.equal(token.id, `56:${NVDAON}`);
  assert.equal(token.symbol, 'NVDAon');
  assert.equal(token.provider.id, 'ondo');
  assert.equal(token.underlying.ticker, 'NVDA');
  assert.ok(token.links.explorer.endsWith(NVDAON));
});

test('v1 errors carry a code, a message, and the right status', async () => {
  const cases = [
    ['/v1/tokens/1/' + NVDAON, 400, 'unsupported_chain'],
    ['/v1/tokens/56/0x123', 400, 'invalid_address'],
    ['/v1/tokens/56/0x' + '1'.repeat(40), 404, 'not_registered'],
    ['/v1/companies/ZZZZ', 404, 'company_not_found'],
    ['/v1/reports/1999-01-01', 404, 'report_not_found'],
    ['/v1/reports/nope', 400, 'invalid_date'],
    ['/v1/tokens?limit=999', 400, 'invalid_limit'],
    ['/v1/tokens/56/%E0%A4%A', 400, 'invalid_path'],
    ['/v1/whatever', 404, 'not_found'],
  ];
  for (const [url, status, code] of cases) {
    const res = await call('GET', url);
    assert.equal(res.status, status, url);
    assert.equal(res.body.error.code, code, url);
    assert.equal(typeof res.body.error.message, 'string');
    assert.equal(res.headers['access-control-allow-origin'], '*');
  }
});

test('v1 bulk lookup answers every address in order, including bad and unknown ones', async () => {
  const unknown = '0x' + '2'.repeat(40);
  const res = await call('POST', '/v1/tokens/lookup', { addresses: [NVDAON, 'nope', unknown] }, { 'content-type': 'application/json' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.results.map((r) => r.status), ['registered', 'invalid_address', 'not_registered']);
  assert.equal(res.body.results[0].token.symbol, 'NVDAon');
  assert.equal((await call('POST', '/v1/tokens/lookup', { addresses: Array(101).fill(NVDAON) })).body.error.code, 'too_many_addresses');
  assert.equal((await call('POST', '/v1/tokens/lookup', '{bad')).body.error.code, 'invalid_json');
  assert.equal((await call('GET', '/v1/tokens/lookup')).status, 405);
});

test('v1 answers CORS preflight and lists companies and reports', async () => {
  const pre = await call('OPTIONS', '/v1/tokens/lookup');
  assert.equal(pre.status, 204);
  assert.match(pre.headers['access-control-allow-methods'], /POST/);
  const company = await call('GET', '/v1/companies/nvda');
  assert.deepEqual(company.body.company.products.map((p) => p.provider.id).sort(), ['bstock', 'ondo', 'xstock']);
  const latest = await call('GET', '/v1/reports/latest');
  assert.equal(latest.status, 200);
  assert.match(latest.body.report.date, /^\d{4}-\d{2}-\d{2}$/);
  const search = await call('GET', '/v1/tokens?q=NVDA&provider=xstock&limit=5');
  assert.ok(search.body.tokens.every((t) => t.provider.id === 'xstock'));
  const health = await call('GET', '/v1/health');
  assert.equal(health.body.status, 'ok');
  assert.ok(health.body.providers.ondo.tokens > 400);
});

test('rate limiter allows the limit per window, then refuses until reset', () => {
  let now = 0;
  const limit = createRateLimiter({ limit: 3, windowMs: 1000, now: () => now });
  assert.deepEqual([1, 2, 3, 4].map(() => limit('a').allowed), [true, true, true, false]);
  assert.equal(limit('b').allowed, true);
  now = 1001;
  assert.equal(limit('a').allowed, true);
});

test('lookup reports provider-published contracts as pending review', () => {
  const address = '0x' + '3'.repeat(40);
  const observation = { observedAt: '2026-11-19T05:00:00Z', ondo: { [address]: { symbol: 'NEWon', name: 'New (Ondo Tokenized)', ticker: 'NEW' } } };
  const [result] = lookupTokens([address], [], observation);
  assert.equal(result.status, 'pending_review');
  assert.equal(result.published.provider, 'Ondo');
  assert.equal(tokenView({ key: '56:0xa', contractAddress: '0xa', platformId: 'xstock' }).provider.name, 'xStocks');
});

test('OpenAPI file references resolve and every documented endpoint is served', async () => {
  const { readFile } = await import('node:fs/promises');
  const spec = JSON.parse(await readFile(new URL('../public/openapi.json', import.meta.url), 'utf8'));
  const refs = JSON.stringify(spec).match(/#\/components\/schemas\/\w+/g) ?? [];
  for (const ref of refs) assert.ok(spec.components.schemas[ref.split('/').pop()], ref);
  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const method of Object.keys(ops)) {
      for (const p of ops[method].parameters ?? []) if (p.in === 'path') assert.ok(path.includes(`{${p.name}}`), `${path} ${p.name}`);
      const url = path.replace('{chainId}', '56').replace('{address}', NVDAON).replace('{ticker}', 'NVDA').replace('{date}', 'latest');
      const res = await call(method.toUpperCase(), url, method === 'post' ? { addresses: [NVDAON] } : undefined);
      assert.notEqual(res.body?.error?.code, 'not_found', `${method} ${path} is not routed`);
      assert.ok(res.status < 500 || path.startsWith('/v1/check'), `${method} ${path} -> ${res.status}`);
    }
  }
});
