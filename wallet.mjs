import { identityKey, normalizeAddress } from './registry.mjs';

export function mapWalletHoldings(walletAddress, tokenAssets, records, observedAt, partial = false) {
  const address = normalizeAddress(walletAddress);
  if (!address) throw new Error('A complete BSC wallet address is required');
  if (!Array.isArray(tokenAssets)) throw new TypeError('Wallet token assets must be an array');
  const byKey = new Map(records.map((record) => [record.key, record]));
  const supported = [], unsupported = [];
  for (const asset of tokenAssets) {
    if (String(asset.binanceChainId) !== '56') continue;
    if (asset.address && normalizeAddress(asset.address) !== address) continue;
    const balance = String(asset.balance ?? '');
    if (!/^\d+(?:\.\d+)?$/.test(balance) || Number(balance) <= 0) continue;
    const key = identityKey('56', asset.tokenContractAddress);
    const record = key ? byKey.get(key) : null;
    if (record) {
      supported.push({
        key, contractAddress: record.contractAddress, companyName: record.companyName,
        underlyingTicker: record.underlyingTicker, tokenSymbol: record.symbol, balance,
      });
    } else {
      unsupported.push({
        contractAddress: normalizeAddress(asset.tokenContractAddress),
        reportedSymbol: String(asset.symbol ?? 'Unknown token').slice(0, 40), balance,
      });
    }
  }
  return { address, chainId: '56', supported, unsupported, observedAt, partial,
    sourceKind: 'third_party_reported',
    sourceUrl: 'https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/wallet-api' };
}
