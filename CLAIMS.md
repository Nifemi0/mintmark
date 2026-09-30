# Mintmark claims and evidence

These are the claims supported by the current local build. Recheck them against the public demo before submission.

| Claim | Evidence | Boundary |
| --- | --- | --- |
| Mintmark identifies BSC stock tokens by exact chain and contract. | `registry.mjs` keys records as `56:contract`; `npm test` checks duplicate rejection and exact-address search. | A matching ticker alone does not establish token equivalence. |
| The current snapshot includes 450 Ondo, 46 bStocks, and 1,069 xStocks contracts. | `data/catalog.json` and `npm run check:release`; source links are listed in `README.md`. | Counts are a dated snapshot, not a guarantee of current trading availability. |
| NVIDIA and TSLA each have three provider records; AAPL has two. | Search the local app for `NVDA`, `TSLA`, or `AAPL`; `tests/catalog.test.mjs` asserts current coverage. | No AAPL bStocks BSC row appeared in the checked Binance list. |
| Each comparison row exposes its own contract and provider legal-document hub. | Browser verification and `docs/registry-nvda.png`; exact contracts link to BscScan. | The legal hubs can contain several documents; Mintmark does not claim each link opens asset-specific final terms directly. |
| Ondo and bStocks reports use Binance data for the exact contract when available. | `report.mjs` rejects a different contract, platform, or underlying ticker; local and public NVDA calls plus `npm test` passed. The production function reports execution in `cpt1`. | Binance figures are third-party reported. US-hosted requests returned compliance code `40304`; production therefore runs in Cape Town, a supported region. |
| xStocks detailed market reports are unavailable. | The `/api/report` response marks xStocks `identity_only`; the UI explains the missing source. | A token identity record is not a market-data report. |
| Wallet lookup is read-only and limited. | `wallet.mjs`, `binance.mjs`, and focused tests match exact contracts in a 24-token Ondo subset. | An empty result does not mean the wallet holds no other tokenized stocks. |
| Mintmark does not independently verify share backing. | Every record includes an unverified custody limitation, and the UI separates issuer, onchain, and third-party claims. | Onchain bytecode and token balances do not prove offchain custody. |
