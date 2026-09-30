const trackedFields = [
  'chainId', 'contractAddress', 'issuer', 'platformId', 'symbol', 'tokenName',
  'underlyingTicker', 'companyName', 'assetType', 'explorerUrl', 'issuerAssetUrl',
];

function identitySnapshot(record) {
  return Object.fromEntries(trackedFields.map((field) => [field, record[field] ?? null]));
}

export function evolveRegistryHistory(previous, records, observedAt, sourceUrl) {
  const history = structuredClone(previous ?? { schemaVersion: 1, records: {} });
  if (history.schemaVersion !== 1 || !history.records || typeof history.records !== 'object') {
    throw new Error('Unsupported registry history format');
  }
  const currentKeys = new Set();
  for (const record of records) {
    currentKeys.add(record.key);
    const snapshot = identitySnapshot(record);
    const existing = history.records[record.key] ?? { entries: [] };
    const last = existing.entries.at(-1);
    const changes = trackedFields.filter((field) => last?.snapshot?.[field] !== snapshot[field])
      .map((field) => ({ field, from: last?.snapshot?.[field] ?? null, to: snapshot[field] }));
    if (!last || changes.length || last.kind === 'removed_from_catalog') {
      existing.entries.push({
        version: (last?.version ?? 0) + 1,
        kind: !last ? 'added' : last.kind === 'removed_from_catalog' ? 'returned_to_catalog' : 'changed',
        observedAt, sourceUrl: record.publisherUrl ?? sourceUrl,
        reviewMethod: 'Automated comparison of provider-published identities and BSC RPC name, symbol, and bytecode',
        changes, snapshot,
      });
    }
    history.records[record.key] = existing;
  }
  for (const [key, existing] of Object.entries(history.records)) {
    if (currentKeys.has(key)) continue;
    const last = existing.entries.at(-1);
    if (last?.kind === 'removed_from_catalog') continue;
    existing.entries.push({
      version: (last?.version ?? 0) + 1, kind: 'removed_from_catalog', observedAt, sourceUrl,
      reviewMethod: 'Automated catalog comparison; removal does not prove the issuer retired the token',
      changes: [], snapshot: last.snapshot,
    });
  }
  return history;
}
