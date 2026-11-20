// Hourly check of the live site; any failure fails the workflow, and GitHub
// emails the repository owner about failed scheduled runs.
const base = process.env.SITE_URL || 'https://mintmark.nuvixes.studio';
const maxAgeHours = Number(process.env.MAX_DATA_AGE_HOURS ?? 48);
const problems = [];

async function get(path, check) {
  const started = Date.now();
  try {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'mintmark-uptime-check' } });
    const ms = Date.now() - started;
    if (!response.ok) { problems.push(`${path} returned HTTP ${response.status}`); return; }
    if (check) await check(response);
    console.log(`ok   ${path} (${ms}ms)`);
  } catch (error) {
    problems.push(`${path} failed: ${error.message}`);
  }
}

await get('/v1/health', async (response) => {
  const health = await response.json();
  if (health.status !== 'ok') problems.push(`/v1/health status is ${health.status}`);
  for (const [provider, info] of Object.entries(health.providers ?? {})) {
    const age = (Date.now() - Date.parse(info.checkedAt)) / 3_600_000;
    if (!(age <= maxAgeHours)) problems.push(`${provider} data is ${Math.round(age)} hours old`);
  }
  const reportAge = (Date.now() - Date.parse(`${health.latestReport}T23:59:59Z`)) / 3_600_000;
  if (!(reportAge <= maxAgeHours)) problems.push(`latest live daily report is ${health.latestReport}`);
});
await get('/v1/tokens/56/0xa9ee28c80f960b889dfbd1902055218cba016f75', async (response) => {
  const { token } = await response.json();
  if (token?.symbol !== 'NVDAon') problems.push('/v1 token lookup returned the wrong token');
});
for (const page of ['/', '/registry', '/reports', '/docs']) await get(page);

if (problems.length) {
  console.error(`\nMintmark live check failed:\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nMintmark is up and its data is fresh.');
}
