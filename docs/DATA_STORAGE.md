# Mintmark data storage

## What exists now

Mintmark's launch database is a versioned, checked snapshot committed with the app:

- `data/catalog.json` has 1,565 exact BSC token identities, provider metadata, sources, and observation times.
- `data/registry-history.json` has the public history for those identity records.
- `data/ondo-bsc.json` is a source snapshot used by the refresh scripts.

The server loads `catalog.json` and `registry-history.json` when it starts. Search and record pages read them in memory. Company reports and wallet balances come from the Binance Web3 API on request and are cached briefly in server memory; they are not stored as permanent claims. The `npm run sync` scripts refresh the JSON snapshots locally, then a reviewed commit and redeploy publish the new snapshot. The live web service does not write to its filesystem.

This is suitable for the initial public demo: everyone sees the same auditable data version, it runs without a database account, and a new deploy can roll back a bad snapshot. It is not a continuously updating registry. The UI must keep showing the snapshot date and source observation times.

## When we add a hosted database

Use managed PostgreSQL when curators need to publish corrections without a code deploy, when scheduled ingestion is required, or when user-owned data is introduced. Do not store private Binance keys in the database; keep them in the deployment's secret environment variables.

The relational identity key remains `(chain_id, contract_address)`, never a ticker. A practical first schema is:

| Table | Purpose |
| --- | --- |
| `providers` | Ondo, bStocks, xStocks, their issuer names and canonical source URLs. |
| `token_products` | One row per chain and exact contract, with provider, underlying company/ticker, token name/symbol, and active catalog status. |
| `claims` | Field value, evidence class, source URL, observed time, and limits for each product. |
| `record_versions` | Immutable before/after changes and review method; the public history reads from here. |
| `ingestion_runs` | Source fetch time, checks performed, record counts, and failures. |

Ingestion should write a new run to staging, validate contracts and duplicates, then promote reviewed changes in one transaction. The public API reads only promoted records. This keeps a bad provider response from silently changing the registry. A migration can seed PostgreSQL from the committed JSON snapshot and preserve existing version history.
