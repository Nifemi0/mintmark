import { existsSync } from 'node:fs';
import { signedRequest } from '../binance.mjs';

const envPath = new URL('../.env.local', import.meta.url);
if (existsSync(envPath)) process.loadEnvFile(envPath);

const address = '0xa9ee28c80f960b889dfbd1902055218cba016f75';
const request = signedRequest('/api/v1/dex/market/rwa/underlying-profile', {
  binanceChainId: '56', tokenContractAddress: address,
});

const [providerResponse, locationResponse] = await Promise.all([
  fetch(request.url, { headers: request.headers, signal: AbortSignal.timeout(12000) }),
  fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(12000) }),
]);
const provider = await providerResponse.json();
const location = locationResponse.ok ? await locationResponse.json() : {};

console.log(JSON.stringify({
  environment: {
    country: location.country ?? null,
    region: location.region ?? null,
    timezone: location.timezone ?? null,
    network: location.org ?? null,
  },
  binance: {
    httpStatus: providerResponse.status,
    code: provider.code ?? null,
    success: provider.success ?? null,
    message: provider.message ?? provider.msg ?? null,
    date: providerResponse.headers.get('date'),
    server: providerResponse.headers.get('server'),
    requestId: providerResponse.headers.get('x-request-id') ?? providerResponse.headers.get('x-trace-id'),
  },
}, null, 2));
