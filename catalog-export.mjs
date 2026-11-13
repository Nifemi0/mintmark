// Public catalog export: the reviewed registry as JSON or CSV, one row per exact BSC contract.

export const EXPORT_FIELDS = [
  'key', 'chainId', 'contractAddress', 'provider', 'issuer', 'symbol', 'tokenName', 'issuerTokenName',
  'underlyingTicker', 'companyName', 'assetType', 'tradingHalted', 'tradingStatusCheckedAt',
  'binanceSpotPair', 'walletLookup', 'explorerUrl', 'issuerTermsUrl', 'sourceUrl', 'observedAt',
];

export function exportRows(records) {
  return records.map((record) => ({
    key: record.key, chainId: '56', contractAddress: record.contractAddress,
    provider: record.providerName ?? ({ ondo: 'Ondo', bstock: 'bStocks', xstock: 'xStocks' })[record.platformId] ?? record.platformId, issuer: record.issuer, symbol: record.symbol,
    tokenName: record.tokenName, issuerTokenName: record.issuerTokenName ?? null,
    underlyingTicker: record.underlyingTicker, companyName: record.companyName, assetType: record.assetType ?? null,
    tradingHalted: record.tradingStatus ? record.tradingStatus.halted : null,
    tradingStatusCheckedAt: record.tradingStatus?.observedAt ?? null,
    binanceSpotPair: record.binanceSpot?.pair ?? null,
    walletLookup: Boolean(record.walletLookupEnabled) || record.platformId === 'bstock',
    explorerUrl: record.explorerUrl ?? null, issuerTermsUrl: record.issuerTermsUrl ?? null,
    sourceUrl: record.publisherUrl ?? null, observedAt: record.observedAt ?? null,
  }));
}

function csvCell(value) {
  if (value == null) return '';
  let text = String(value);
  // Keep spreadsheet apps from treating a cell as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows) {
  return `${[EXPORT_FIELDS.join(','), ...rows.map((row) => EXPORT_FIELDS.map((field) => csvCell(row[field])).join(','))].join('\r\n')}\r\n`;
}
