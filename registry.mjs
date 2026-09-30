export const BSC_CHAIN_ID = '56';
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function normalizeAddress(value) {
  if (typeof value !== 'string' || !ADDRESS.test(value.trim())) return null;
  return value.trim().toLowerCase();
}

export function identityKey(chainId, address) {
  const normalized = normalizeAddress(address);
  if (!normalized || String(chainId) !== BSC_CHAIN_ID) return null;
  return `${BSC_CHAIN_ID}:${normalized}`;
}

export function normalizeRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('Records must be an array');
  const seen = new Set();
  return records.map((record) => {
    const key = identityKey(record.chainId, record.contractAddress);
    if (!key) throw new Error(`Invalid BSC contract in record: ${record.symbol ?? 'unknown'}`);
    if (seen.has(key)) throw new Error(`Duplicate identity: ${key}`);
    seen.add(key);
    if (!record.issuer || !record.platformId || !record.symbol || !record.tokenName || !record.underlyingTicker || !record.companyName) {
      throw new Error(`Missing required identity field: ${key}`);
    }
    return { ...record, key, contractAddress: normalizeAddress(record.contractAddress) };
  });
}

export function classifyEvidence(kind) {
  const allowed = new Set(['onchain_observed', 'issuer_published', 'third_party_reported', 'unverified']);
  if (!allowed.has(kind)) throw new Error(`Unsupported evidence class: ${kind}`);
  return kind;
}

export function searchRecords(records, query) {
  const term = String(query ?? '').trim().toLowerCase();
  if (!term) return records;
  const possibleAddress = term.startsWith('0x');
  if (possibleAddress) {
    const address = normalizeAddress(term);
    return address ? records.filter((record) => record.contractAddress === address) : [];
  }
  return records.filter((record) =>
    [record.symbol, record.underlyingTicker, record.companyName, record.issuer, record.providerName, record.platformId, record.category, ...(record.keywords ?? [])]
      .some((part) => String(part ?? '').toLowerCase().includes(term))
  );
}

export function crossCheckBinance(records, apiRows, observedAt = new Date().toISOString()) {
  if (!Array.isArray(apiRows)) throw new TypeError('Binance response must be an array');
  const byKey = new Map();
  for (const row of apiRows) {
    const key = identityKey(row.binanceChainId, row.tokenContractAddress);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return records.map((record) => {
    const rows = byKey.get(record.key) ?? [];
    if (!rows.length) return { ...record, binanceCheck: { state: 'not_found', observedAt, detail: 'This exact BSC contract was not in the current Binance RWA list.' } };
    if (rows.length > 1) return { ...record, binanceCheck: { state: 'conflict', observedAt, detail: `Binance returned ${rows.length} rows for this exact BSC contract; the identity needs review.` } };
    const row = rows[0];
    const identityFields = [
      ['platform', row.platformId, record.platformId],
      ['underlying ticker', row.underlyingTicker, record.underlyingTicker],
      ['token symbol', row.tokenSymbol, record.symbol],
    ];
    const missing = identityFields.filter(([, actual]) => typeof actual !== 'string' || !actual.trim()).map(([label]) => label);
    const differing = identityFields.filter(([, actual, expected]) => typeof actual === 'string' && actual.trim() && actual.toLowerCase() !== String(expected ?? '').toLowerCase()).map(([label]) => label);
    const nameMissing = typeof row.tokenName !== 'string' || !row.tokenName.trim();
    const nameDiffers = !nameMissing && row.tokenName.toLowerCase() !== record.tokenName.toLowerCase();
    const state = differing.length ? 'conflict' : missing.length || nameMissing ? 'incomplete' : nameDiffers ? 'name_difference' : 'matched';
    const detail = differing.length
      ? `Binance differs on ${differing.join(', ')}; the identity needs review.`
      : missing.length || nameMissing
        ? `Binance omitted ${[...missing, ...(nameMissing ? ['token name'] : [])].join(', ')}; a full comparison is not possible.`
        : nameDiffers
          ? `Exact BSC contract, issuer platform, ticker, and symbol agree. Ondo/onchain name: “${record.tokenName}”; Binance display name: “${row.tokenName}”.`
          : 'Binance RWA data agrees on exact BSC contract, issuer platform, underlying ticker, token symbol, and token name.';
    return {
      ...record,
      binanceCheck: { state, observedAt, detail, sourceUrl: 'https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data' },
    };
  });
}
