# Mintmark — three-phase build plan

**Target:** BNB Hack: Tokenized Stocks Edition. Submissions lock **11 October 2026 at 12:00 UTC (13:00 in Lagos)**. The working product must center a supported tokenized stock on **BSC mainnet** and use at least one Binance Web3 API module. [Official brief](https://www.bnbchain.org/en/hackathons/tokenized-stocks).

**Product promise:** Search a company and compare its BSC token products by exact contract, provider, terms, and evidence. Binance data appears where an exact-contract source exists; missing data stays unavailable.

**Submission scope locked on 30 September:** NVIDIA, TSLA, and AAPL are searchable. NVIDIA and TSLA each have Ondo, bStocks, and xStocks records; AAPL currently has Ondo and xStocks, because the checked bStocks BSC list has no AAPL row. Each available product shows its contract and terms. Ship a short demo video and the builder's human-written developer experience report. Defer a new onchain registry anchor, a full-wallet scan, and detailed reports for all xStocks until after 11 October.

**Current instruction:** Finish and review product features before doing any video work. Video production is on hold until the user says the feature set is final.

**Current state (30 September):** The separate [Mintmark app](./README.md) now combines 1,565 checked BSC contracts from Ondo (450), bStocks (46), and xStocks (1,069). Search can show three distinct products and contracts for the same company. Provider metadata and BSC bytecode/name/symbol were checked; product terms and evidence remain separate. Live Binance RWA cross-checks are visible for Ondo records. Phase 1 was approved. Phase 2 is implemented locally and awaiting user review: read-only wallet lookup for 24 explicitly labeled Ondo contracts, sourced public-data company reports where Binance provides exact-contract data, expandable evidence, and visible version history. xStocks records identify unavailable market data rather than borrowing another provider's report. Records open in a dialog. Postbell and AfterBell are separate products.

## Scope that stays fixed across phases

- **Core record:** BSC chain ID and contract address, issuer/platform, underlying ticker/company, product description, source links, observation time, and record version. Chain plus contract is the identity key; ticker is only a search term.
- **Evidence classes:** `onchain observed`, `issuer published`, `third-party reported`, and `unverified`. The interface shows the source and last check for each field. A token balance is never presented as proof of offchain share custody.
- **Current coverage:** Ondo, bStocks, and xStocks BSC catalogs, with separate exact contracts, provider sources, product terms, and visible source differences.
- **Two product capabilities:** (1) exact token identity records with source-by-source evidence; (2) a public record history showing additions, changes, and unresolved discrepancies. Wallet lookup is a route into those records.
- **Out of scope for this sprint:** swaps, price alerts, market briefs, social circles, investment recommendations, a universal corporate-action feed, Solana/Ethereum support, and claims that Mintmark independently verifies issuer custody.

## Phase 1 — Real registry foundation

**Target window:** 29 September–2 October.

**Build:**

- Create Mintmark as its own app under `chain-products/mintmark`, using the approved dark minimal direction.
- Integrate Binance RWA Data server-side; keep API credentials out of the browser and repository.
- Ingest a small set of real Ondo BSC token records, keyed by `56:contractAddress`, and cross-check contract, name, and symbol against BSC RPC and Ondo's published asset list. Link each contract to BscScan for inspection.
- Build search by ticker or exact contract, the directory, and one full record page. Every displayed claim carries an evidence class, source link, and last-checked time.
- Define unknown and conflicting-data states; never silently treat a ticker match as an identity match.
- Keep a factual integration log for the required developer experience report: first API call, errors, latency, missing fields, and confusing documentation.

**Done when:** A fresh local run can search at least one real BSC token, open its record, follow every source, and correctly reject or mark an unknown contract. Focused tests cover normalization, chain/contract matching, duplicate detection, and evidence classification.

**Your confirmation:** I show the working directory and record flow, the actual source links, and test results. We stop for your review of the identity model and visual hierarchy before Phase 2.

## Phase 2 — Holder flow and public evidence history

**Target window:** 3–7 October.

**Build:**

- Add read-only BSC wallet-address lookup via the Wallet API. Match supported balances to exact registry contracts; unsupported holdings remain clearly unlabeled.
- Add a sourced company report for each record: industry and public company description, underlying reference price, market cap, 52-week range, valuation/dividend fields when available, and a 30-day chart of **token** price movement. Clearly distinguish token prices from underlying-share reference prices; do not fill missing fields or imply investment advice.
- Build the evidence drawer: each claim expands to its source, observation time, and limits. Show issuer statements separately from onchain observations.
- Add versioned registry records with a visible change log. Each update records what changed, the source that justified it, and who/what reviewed it. Preserve prior versions and unresolved discrepancies.
- Handle loading, stale data, API failure, empty wallet, malformed address, and conflicting issuer information in the UI.
- Add meaningful end-to-end checks for search → record → evidence and wallet → exact holding → record. Exercise a live API response and document any provider gaps.

**Done when:** A BSC wallet holding can be matched to a supported contract without a false ticker match, and a visitor can inspect a record's source and correction history. The flow remains usable on mobile and keyboard.

**Your confirmation:** I demo one supported holding and one unknown/ambiguous case, show the version history and failed-data states, and share the test results. We stop for your review before Phase 3.

## Phase 3 — Submission package

**Target window:** 8–10 October, leaving a buffer before the 11 October deadline.

**Build:**

- Check the three priority searches (NVIDIA, TSLA, AAPL) and every returned product's contract, source, and terms link. Show AAPL's two current products accurately.
- Demonstrate Binance company and market data for an exact Ondo or bStocks contract and the explicit unavailable state for an xStocks contract.
- Run the app from a fresh checkout and check the demo route, mobile layout, broken sources, accessibility, secret exposure, and claims made in the UI.
- Prepare an accessible demo, setup instructions, a claims/evidence list, and truthful testing status. Keep the short video of **four minutes or less** on hold until the user confirms the feature set is final. External publishing and submission happen only after the relevant review.
- Supply factual integration notes for the **developer experience report**. The builder writes the specific final report in their own words; these notes are not submission prose.

**Done when:** The accessible demo uses real BSC contracts and sourced Binance data, the three priority searches work, the short video and builder-written DevEx report are ready, and the submission accurately states limitations. Until the feature review releases the video hold, mark this phase as in progress.

**Your confirmation:** I present the demo, video, repository, testing status, and submission materials for your final review. I do not submit the entry or publish new external artifacts before the relevant authorization.

## After 11 October

- Explore a BSC registry snapshot anchor only if it adds clear user value.
- Expand wallet discovery beyond the 24 explicitly supported Ondo contracts without implying that a partial scan is complete.
- Research and verify exact-contract sources for detailed xStocks company and market reports before showing those fields.

## Build risks to resolve early

1. **Originality:** Daybreak already compares issuers, chains, and exact assets. Mintmark must make source-level evidence and a visible correction history the center of the experience, not repackage discovery or trading.
2. **Data gaps:** The Binance RWA API identifies tokens and provides some issuer metadata, but it does not establish every legal right or a complete corporate-action history. Missing fields stay missing.
3. **API access:** A Binance developer API key may require registration. Phase 1 should discover this immediately; an illustrative fixture can support UI work but cannot satisfy the live-integration gate.
4. **Mainnet scope:** This event specifies BSC mainnet. Cross-chain examples in the visual preview remain illustrations unless separately verified, and they are not core to this entry.

**Sources:** [BNB Hack brief](https://www.bnbchain.org/en/hackathons/tokenized-stocks), [Binance RWA Data API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data), [Binance Wallet API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/wallet-api).
