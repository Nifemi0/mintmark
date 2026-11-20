# Mintmark

Mintmark is a BSC tokenized-stock identity registry spanning **Ondo, bStocks, and xStocks**. It maps each **exact chain and contract** to a provider's published asset, checks contract name and symbol on BSC, and shows the source and evidence class for each claim. Search NVIDIA, for example, to compare NVDAon, NVDAB, and NVDAx as three separate products in an evidence matrix covering onchain identity, source records, Binance RWA coverage, report availability, wallet support, contracts, and legal documents.

For a concrete example, NVIDIA resolves to three separate BSC contracts: [Ondo NVDAon (0xa9ee…6f75)](https://bscscan.com/address/0xa9ee28c80f960b889dfbd1902055218cba016f75), [bStocks NVDAB (0x02fc…7436)](https://bscscan.com/address/0x02fca66c1d1afb4e2a7884261eb00f63598a7436), and [xStocks NVDAx (0xc845…849d)](https://bscscan.com/address/0xc845b2894dbddd03858fd2d643b4ef725fe0849d). The registry shows their full addresses and provider evidence.

![Mintmark comparing three NVIDIA token products](docs/registry-nvda.png)

**Live product:** [mintmark.nuvixes.studio](https://mintmark.nuvixes.studio) · **Demo:** [watch the four-minute product walkthrough](https://youtu.be/7Puxgq8_8Fk) · **Source:** [github.com/Nifemi0/mintmark](https://github.com/Nifemi0/mintmark)

The production deployment serves the checked catalog (1,937 contracts at the 13 November 2026 refresh; `/v1/health` gives the live count), shareable company comparisons, exact contract records, evidence, version history, live Binance-backed exact-contract market coverage, Ondo and bStocks company reports, and the supported wallet lookup. Binance credentials stay encrypted in Vercel and are never sent to the browser. [Claims and evidence](CLAIMS.md) and the live status at `/v1/health` state what has and has not been verified.

**Data storage:** The catalog and public record history are versioned JSON snapshots loaded by the server. Production reads the same checked snapshot and does not write corrections at runtime. [Data storage and the PostgreSQL migration path](docs/DATA_STORAGE.md) explains how updates are reviewed and when persistent storage is needed.

## Run locally

Requires Node.js 22 or newer. No npm dependencies are required.

```sh
npm start
```

Open `http://localhost:4173`. The included `data/catalog.json` snapshot lets the app start without credentials or a sync: **1,937 checked BSC contracts: 474 Ondo, 46 bStocks, and 1,417 xStocks** at the 13 November 2026 refresh; the daily workflow refreshes Ondo and xStocks automatically. Every provider retains its own contract, source, product terms, and evidence. To refresh the [Ondo contract list](https://docs.ondo.finance/addresses), the Binance RWA list's bStocks rows, and the [xStocks public asset API](https://docs.xstocks.fi/apis/openapi/assets/list_public_assets), configure Binance credentials as described below and run `npm run sync`. It checks BSC bytecode and ERC-20 name/symbol for every included contract. `npm run sync:providers` refreshes bStocks and xStocks using the existing Ondo snapshot; it also requires Binance credentials.

The directory and record view show provider-published token images. Ondo images are cached locally; `npm run sync:logos` refreshes them from Ondo's CDN and `public/logos/sources.json` records their URLs. bStocks and xStocks images load from their published image hosts. Images aid recognition only; chain and contract establish identity. If an image cannot load, the interface falls back to the ticker's initial.

To refresh bStocks or enable live Binance checks, company reports, exact-contract token-market coverage, and wallet lookup, copy `.env.example` to `.env.local` and set `OC_API_KEY` and `OC_SECRET_KEY`; restart the server. The server signs requests using the documented `/build` path and never sends credentials to the browser. The page clearly marks when a live cross-check has not run. API keys are not required to view the bundled catalog. xStocks can receive exact-contract token-market coverage from Binance's general Market API while its underlying-company report remains explicitly unavailable when Binance RWA data does not cover that product.

Search comparisons are linkable: `/?q=NVDA#registry` opens all NVIDIA products, and record links preserve that comparison context. The public [`llms.txt`](https://mintmark.nuvixes.studio/llms.txt) describes the identity model, API routes, evidence semantics, and limitations. `npm run check:freshness` verifies that the checked catalog is no more than 48 hours old; the daily GitHub Actions workflow runs that check with the test and release suites.

`npm run report` writes the daily change report to `data/reports/` by comparing the live Ondo, xStocks, and Binance Spot lists (and the Binance RWA bStocks list when credentials are set) with the previous observation. The site shows it at `/reports`, with JSON at `/api/daily-report` and RSS at `/api/reports/feed.xml`. A scheduled GitHub Actions workflow builds the report each morning and publishes it to `main`, then starts a Vercel deploy through the `VERCEL_DEPLOY_HOOK` secret. A report that looks like a provider outage or a mass change (for example ten or more tokens disappearing from one provider, or new contracts missing on BSC) is held as a pull request for review instead. Mintmark's own product notes for the report come from `data/product-updates.json`.

Run focused checks with `npm test`.

## Hosting

The app is deployed on Vercel. Vercel serves `public/` as the front end and routes `/api/*` to the Node handler in Cape Town (`cpt1`). The included JSON snapshot is bundled with that handler. The public site shows the catalog, exact records, evidence, and history without a database account. Company reports, live Binance cross-checks, and wallet lookup use `OC_API_KEY` and `OC_SECRET_KEY` stored as encrypted production variables. The earlier Washington, D.C. deployment and the tested US VPS returned Binance code `40304`; Cape Town returns successful live data. Local `.env.local` is excluded from the deployed bundle, and the production build was checked for private-key matches before upload.

## What the labels mean

- **Onchain observed:** Mintmark read the token contract's name and symbol from BSC RPC. This establishes those contract responses, not backing or legal rights.
- **Issuer published:** Ondo and xStocks publish their asset identity and BSC contract. These remain provider statements, with their sources linked.
- **Unverified:** Mintmark does not independently inspect shares held by the issuer or custodian.
- **Third-party reported:** Binance provides the bStocks catalog, some company profiles, market figures, BSC token candles, and wallet balances. These are timestamped provider reports, not Mintmark's own exchange or custody observations.

The exact-contract market card shows the Binance-reported token price, 24-hour change, volume, liquidity, holders, and transaction activity when available. Mintmark requires the returned chain and contract to match the open record, preserves the provider and retrieval times, and displays missing or internally surprising fields as coverage notes. The separate company report shows industry, public description, market cap, 52-week range, valuation and dividend fields when available. Its reference price is derived by the provider from token price and is not an official exchange quote. The 30-day chart shows **BSC token** daily closing prices, not stock-exchange history. Missing fields remain unavailable.

Wallet lookup is read-only. It sends the entered address to the server and Binance Wallet API and checks **70 supported contracts: the original 24 Ondo wallet-enabled contracts and all 46 bStocks contracts**, clearly labeled in the UI. xStocks holdings are not checked. This is a smaller subset than the 1,937-record discovery catalog; it does not scan or classify all other wallet tokens. Supported holdings link to their exact records.

Each record includes expandable claim evidence and a public version history saved in `data/registry-history.json`. A version is added only when a tracked identity field changes during `npm run sync`, or the token leaves or returns to the curated catalog. The current first versions are an initial baseline, not a claim of historical issuer changes. A catalog removal does not prove issuer retirement. Unresolved Binance identity conflicts remain visible.

The comparison view exposes an evidence matrix before a full record is opened. Provider and issuer links remain evidence sources. Mintmark does not promote third-party exchanges. Any future referral action in this Binance hackathon build will be Binance-native, limited to eligible bStocks products, and clearly labeled as an affiliate link.

The live product includes a clearly disclosed Binance Referral Lite link in the product footer area and on bStocks records. The link is an affiliate action: the builder may receive a reward when a visitor registers and completes eligible activity. Mintmark does not claim that following the link guarantees a reward, regional availability, or liquidity for a specific token.

For the submission demo, NVIDIA and TSLA each have three separate provider records. AAPL currently has two: Ondo and xStocks; the checked bStocks BSC list has no AAPL row. The legal-document links lead to each provider's documentation hub; individual final terms may need to be opened there. The current submission scope and later backlog are in [BUILD_PLAN.md](./BUILD_PLAN.md).

## Sources

- [BNB Hack brief](https://www.bnbchain.org/en/hackathons/tokenized-stocks)
- [Ondo smart contract addresses and official token list](https://docs.ondo.finance/addresses)
- [xStocks public asset API](https://docs.xstocks.fi/apis/openapi/assets/list_public_assets)
- [xStocks legal overview](https://docs.xstocks.fi/docs/product-legal-overview)
- [Binance bStocks overview](https://www.binance.com/en/academy/articles/what-are-bstocks-a-guide-to-tokenized-stocks-on-binance)
- [Binance RWA Data API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data)
- [Binance Wallet API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/wallet-api)
- [Binance General Data API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/general-data)
- [Binance authentication](https://web3.binance.com/en/dev-docs/authentication)
