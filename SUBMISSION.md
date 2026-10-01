# Mintmark submission packet

Prepared for **BNB Hack: Tokenized Stocks Edition**. This is a local draft for review; nothing has been sent to the submission form.

## Form links

- **Project name:** Mintmark
- **Public repository:** https://github.com/Nifemi0/mintmark
- **Deployed product:** https://mintmark.nuvixes.studio
- **Track:** Main track: Tokenized Stocks Products & Agents
- **Hackathon registration:** Unconfirmed. Check the official registration form with the builder's Google account before submitting the project.
- **Demo video:** Pending. Keep the final recording at four minutes or less.
- **Developer Experience Report:** Complete the separate report from `docs/submission/DEVEX-REPORT-WORKSHEET.md`.
- **Builder details still required:** registration confirmation, registration email, ERC-20 wallet address or Binance UID, and optional Telegram handle. Keep these details out of the public repository and enter them directly in the official form.

## One-line summary

Mintmark is the identity and evidence layer for tokenized stocks on BNB Smart Chain: search a familiar company, compare its separate provider contracts, and inspect the source behind every claim.

## What did you build?

Mintmark is a public BSC tokenized-stock registry for people who recognize a company but may not know its onchain ticker or contract. A user can search NVIDIA, Tesla, Apple, a fund name, a ticker, or an exact BSC address. Mintmark then keeps each provider product separate and shows its exact contract, issuer, legal-document hub, onchain name and symbol, evidence class, observation time, and public record history.

The current checked snapshot contains 1,565 distinct BSC contracts: 450 Ondo products, 46 bStocks products, and 1,069 xStocks products. NVIDIA and Tesla each resolve to three separate products; Apple resolves to Ondo and xStocks because the checked bStocks list contains no AAPL row.

Mintmark calls the Binance Web3 **RWA Data API** for token identity, underlying-company profiles, and market fields; the **Market API** for 30-day BSC token candles; and the **Wallet API** for read-only, exact-contract balance lookup across 24 explicitly supported Ondo contracts. Missing sources stay missing: xStocks reports are labeled identity-only instead of borrowing figures from another provider. Credentials remain server-side, and production runs from Vercel's Cape Town region after US-hosted requests returned Binance compliance code `40304`.

## Problem

A stock ticker is useful for discovery but is not an onchain identity. The same underlying company can have different BSC tokens from different issuers, with different contracts, symbols, terms, and data coverage. Interfaces that collapse them into one ticker can hide which product a user actually found.

## Solution

Mintmark keys every product by `chain ID + exact contract address`, then presents ticker and company names only as discovery aids. It separates four kinds of claims: onchain observations, issuer publications, third-party reports, and facts that remain unverified. Every record exposes its sources and limits, while a visible version history preserves changes and unresolved discrepancies.

## Why it matters

Tokenized-stock tooling should help a user answer “which token is this?” before it encourages any financial action. Mintmark gives non-crypto-native users a familiar search path while retaining the contract-level precision needed onchain. It also gives builders a normalized, source-aware directory across Ondo, bStocks, and xStocks without pretending that matching tickers create equivalent products.

## Key features

- Search by company, fund, ticker, keywords, or exact BSC contract.
- Compare distinct Ondo, bStocks, and xStocks products for the same underlying.
- Inspect exact contracts, issuer pages, legal-document hubs, and evidence limits.
- Read Binance-backed company and market reports for exact Ondo and bStocks contracts.
- See explicit identity-only states where matching report data is unavailable.
- Check a BSC wallet against 24 supported Ondo contracts without connecting or signing.
- Review public record versions and unresolved source differences.

## Technical architecture

- **Frontend:** dependency-free HTML, CSS, and browser JavaScript served from `public/`.
- **Server:** Node.js 22 request handler deployed as a Vercel function in `cpt1`.
- **Registry storage:** reviewed JSON snapshots committed to Git and loaded into memory; production does not mutate them.
- **Identity model:** lowercase `56:contractAddress` keys, never ticker-only matching.
- **Provider ingestion:** Ondo's published BSC list, Binance RWA bStocks rows, and the xStocks public asset API.
- **Onchain checks:** BSC RPC bytecode plus ERC-20 `name` and `symbol` reads.
- **Live integrations:** signed Binance RWA, Market, and Wallet API requests with private credentials held in encrypted production variables.
- **Operational controls:** bounded retry for temporary rate limits, a 60-second receive window for clock tolerance, short-lived report and wallet caches, and explicit unavailable/conflict states.

## Testing instructions

1. Open https://mintmark.nuvixes.studio.
2. Search `NVIDIA`; verify three rows: Ondo `NVDAon`, bStocks `NVDAB`, and xStocks `NVDAx`.
3. Open an Ondo or bStocks record; inspect the exact contract, evidence rows, record history, company report, market fields, and token-price chart.
4. Open the xStocks NVIDIA record; confirm that detailed market figures are explicitly unavailable for that exact product.
5. Search `AAPL`; verify two products rather than an invented third bStocks row.
6. In wallet lookup, try the public example; verify supported holdings open their exact registry records.

Local reproduction requires Node.js 22 or newer:

```sh
git clone https://github.com/Nifemi0/mintmark.git
cd mintmark
npm test
npm run check:release
npm start
```

Open `http://localhost:4173`. The checked registry works without API credentials. Live Binance reports and wallet lookup require the environment variables documented in `.env.example`.

## Verified evidence

- `npm test`: 21 passing tests.
- `npm run check:release`: 1,565 checked contracts, priority searches present, legal links present, and no configured private credential values in distributable files.
- Production Chrome QA at 1440×900 and 390×844: search, comparison, record dialog, evidence expansion, history, live reports, unavailable state, wallet validation, and public example passed.
- No production console exceptions, failed requests, HTTP errors, broken images, or horizontal overflow were observed in the latest run.
- QA screenshots are stored in `docs/qa-production-*.png`; the repeatable flow is `scripts/qa-production-cdp.mjs`.

## Claim limits

- Contract bytecode, name, and symbol checks establish contract responses, not offchain share custody or legal rights.
- Binance company and market fields are third-party reports, not official exchange quotes or independent custody checks.
- The wallet feature checks 24 known Ondo contracts and does not scan every wallet asset.
- The catalog is a dated snapshot, and a missing provider row is treated as a data gap rather than proof that a product is invalid.
- Mintmark does not trade, simulate transactions, recommend investments, or measure liquidity and slippage.

## Screenshot shot list

- Landing page and company-first search: `docs/qa-production-desktop-home.png`
- NVIDIA exact record and evidence: `docs/qa-production-desktop-report.png`
- Mobile landing page: `docs/qa-production-mobile-home.png`
- Mobile record dialog: `docs/qa-production-mobile-report.png`

## Development process

Codex assisted with implementation, debugging, test automation, documentation, and deployment. Product decisions were driven by builder review: company-first discovery replaced ticker-only navigation; records moved into a focused dialog; provider coverage expanded from a small sample to 1,565 checked contracts; unavailable xStocks data stayed visible rather than being filled from another product; and the production runtime moved to Cape Town only after host diagnostics isolated Binance's regional compliance response.

## Readiness

The repository, live product, core written entry, evidence, and testing instructions are ready for review. Remaining work is limited to builder-owned form details, the builder-authored DevEx answers, and the optional demo video.
