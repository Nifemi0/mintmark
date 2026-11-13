// Look-alike checker: for a BSC contract that is not in the registry, read its
// onchain identity and list registry products it could be mistaken for.

const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
const SUFFIXES = ['ON', 'B', 'X'];

export function decodeAbiString(raw) {
  if (typeof raw !== 'string' || !/^0x[0-9a-f]*$/i.test(raw) || raw.length < 130) throw new Error('Invalid ABI string');
  const offset = Number(BigInt(`0x${raw.slice(2, 66)}`));
  const lengthStart = 2 + offset * 2;
  const length = Number(BigInt(`0x${raw.slice(lengthStart, lengthStart + 64)}`));
  if (!Number.isSafeInteger(length) || length < 1 || length > 256) throw new Error('Unexpected ABI string length');
  const encoded = raw.slice(lengthStart + 64, lengthStart + 64 + length * 2);
  if (encoded.length !== length * 2) throw new Error('Truncated ABI string');
  return Buffer.from(encoded, 'hex').toString('utf8');
}

export async function readTokenIdentity(address, fetchImpl = fetch, rpcUrl = RPC_URL) {
  const calls = [
    { jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] },
    { jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: address, data: '0x95d89b41' }, 'latest'] },
    { jsonrpc: '2.0', id: 3, method: 'eth_call', params: [{ to: address, data: '0x06fdde03' }, 'latest'] },
  ];
  const response = await fetchImpl(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(calls), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`BSC RPC returned HTTP ${response.status}`);
  const replies = await response.json();
  const byId = new Map((Array.isArray(replies) ? replies : []).map((reply) => [reply.id, reply.result]));
  const code = byId.get(1);
  if (code == null) throw new Error('BSC RPC did not return contract bytecode');
  if (code === '0x') return { state: 'no_contract' };
  const read = (raw) => { try { return decodeAbiString(raw); } catch { return null; } };
  return { state: 'contract', symbol: read(byId.get(2)), name: read(byId.get(3)) };
}

const norm = (value) => String(value ?? '').trim().toUpperCase();

// Registry products that share a symbol, name, or underlying ticker with the
// unknown contract's onchain identity.
export function findLookalikes(records, identity, limit = 8) {
  if (identity?.state !== 'contract') return [];
  const symbol = norm(identity.symbol);
  const name = norm(identity.name);
  const tickers = new Set(symbol ? [symbol] : []);
  for (const suffix of SUFFIXES) if (symbol.length > suffix.length && symbol.endsWith(suffix)) tickers.add(symbol.slice(0, -suffix.length));
  const matches = [];
  for (const record of records) {
    let reason = null;
    if (symbol && norm(record.symbol) === symbol) reason = 'same_symbol';
    else if (name && (norm(record.tokenName) === name || norm(record.issuerTokenName) === name)) reason = 'same_name';
    else if (tickers.has(norm(record.underlyingTicker))) reason = 'same_underlying';
    if (reason) matches.push({ reason, key: record.key, symbol: record.symbol, companyName: record.companyName, providerName: record.providerName ?? record.issuer, contractAddress: record.contractAddress });
  }
  const order = { same_symbol: 0, same_name: 1, same_underlying: 2 };
  return matches.sort((a, b) => order[a.reason] - order[b.reason] || a.symbol.localeCompare(b.symbol)).slice(0, limit);
}

export function lookalikeVerdict(identity, lookalikes) {
  if (identity.state === 'no_contract') return 'no_contract';
  if (lookalikes.some((item) => item.reason !== 'same_underlying')) return 'impersonation_risk';
  if (lookalikes.length) return 'related_unregistered';
  return 'unknown';
}
