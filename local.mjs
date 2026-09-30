import { createServer } from 'node:http';
import { existsSync } from 'node:fs';

const envPath = new URL('./.env.local', import.meta.url);
if (existsSync(envPath)) process.loadEnvFile(envPath);
const { default: handleRequest } = await import('./app-handler.mjs');

const port = Number(process.env.PORT || 4173);
createServer(handleRequest).listen(port, () => console.log(`Mintmark running at http://localhost:${port}`));
