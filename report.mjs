import { identityKey } from './registry.mjs';

const RWA_DOCS = 'https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data';
const CANDLE_DOCS = 'https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/general-data';

function sameIdentity(record, data, label) {
  if (!data || identityKey(data.binanceChainId, data.tokenContractAddress) !== record.key || data.platformId !== record.platformId) {
    throw new Error(`${label} did not identify the exact registry contract and issuer`);
  }
}

function numericText(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? String(value) : null;
}

export function normalizeCandles(data) {
  if (!Array.isArray(data)) throw new Error('Token candles returned an unexpected shape');
  const points = data.map((row) => ({ close: Number(row?.[3]), timestamp: Number(row?.[5]) }))
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isSafeInteger(point.timestamp) && point.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  return points.filter((point, index) => index === 0 || point.timestamp !== points[index - 1].timestamp);
}

export function buildCompanyReport(record, profileResult, marketResult, candleResult) {
  sameIdentity(record, profileResult.data, 'Company profile');
  sameIdentity(record, marketResult.data, 'Underlying market data');
  if (String(profileResult.data.underlyingTicker).toUpperCase() !== record.underlyingTicker.toUpperCase()) {
    throw new Error('Company profile ticker conflicts with the exact registry record');
  }
  const company = profileResult.data.companyInfo ?? {};
  const market = marketResult.data.marketData ?? {};
  const points = normalizeCandles(candleResult.data);
  const first = points[0], last = points.at(-1);
  return {
    key: record.key,
    company: {
      name: record.companyName,
      ticker: record.underlyingTicker,
      industry: typeof company.industry === 'string' && company.industry.trim() ? company.industry.trim() : null,
      description: typeof company.description === 'string' && company.description.trim() ? company.description.trim() : null,
      website: typeof company.website === 'string' && /^https:\/\//.test(company.website) ? company.website : null,
      ceo: typeof company.ceo === 'string' && company.ceo.trim() ? company.ceo.trim() : null,
      sourceKind: 'third_party_reported', sourceUrl: RWA_DOCS, retrievedAt: profileResult.observedAt,
    },
    underlyingMarket: {
      referencePrice: numericText(market.referencePrice),
      marketCap: numericText(market.marketCap),
      high52W: numericText(market.high52W),
      low52W: numericText(market.low52W),
      volumeShares24H: numericText(market.volumeShares24H),
      peRatioTTM: numericText(market.peRatioTTM),
      pbRatio: numericText(market.pbRatio),
      dividendYield: numericText(market.dividendYield),
      latestDividend: numericText(market.latestDividend),
      marketStatus: typeof marketResult.data.statusInfo?.marketStatus === 'string' ? marketResult.data.statusInfo.marketStatus : null,
      sourceKind: 'third_party_reported', sourceUrl: RWA_DOCS, retrievedAt: marketResult.observedAt,
    },
    tokenMovement: {
      points,
      firstClose: first?.close ?? null,
      lastClose: last?.close ?? null,
      changePct: first && last && first.timestamp !== last.timestamp ? (last.close / first.close - 1) * 100 : null,
      firstAt: first?.timestamp ?? null,
      lastAt: last?.timestamp ?? null,
      sourceKind: 'third_party_reported', sourceUrl: CANDLE_DOCS, retrievedAt: candleResult.observedAt,
      description: 'Daily closes for the BSC token. This is not a historical quote for the underlying exchange-listed share.',
    },
  };
}
