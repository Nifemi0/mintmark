# Mintmark submission draft

This is a factual draft for the builder to review. It is not a submitted entry or the required developer experience report.

**Project:** Mintmark

**One-line description:** A BSC tokenized-stock registry that lets people search a familiar company and compare the exact contracts, issuers, legal-document links, and evidence behind its separate token products.

**What it does:** Search NVIDIA, Tesla, or Apple by company name or ticker. Mintmark returns each provider's distinct BSC token record rather than treating a shared stock ticker as one token. NVIDIA and Tesla currently return Ondo, bStocks, and xStocks; Apple returns Ondo and xStocks. A record includes the exact BSC contract, source links, onchain name and symbol checks, evidence classifications, and a visible record history. Where Binance Web3 API data is available for the exact contract, Mintmark adds a sourced company and token-market report. It labels unavailable xStocks report data and limits read-only wallet lookup to 24 checked Ondo contracts.

**Why it exists:** The same underlying stock can have different token issuers, contracts, and legal rights. A familiar ticker is useful for discovery, but it is not enough to establish token identity. Mintmark puts the exact contract and its evidence next to the provider's terms so a visitor can inspect the product they actually found.

**Binance integration:** The server signs Binance Web3 RWA Data API and Wallet API requests. It uses exact BSC contracts for matching and keeps private API credentials server-side. Missing or conflicting data is shown as unavailable or unresolved.

**How judges can run it:** Clone the public repository once published, use Node.js 22 or newer, run `npm start`, and open `http://localhost:4173`. The bundled checked catalog works without API keys. For live Binance reports and wallet lookup, copy `.env.example` to `.env.local`, add Binance Web3 credentials, and restart. Run `npm test` and `npm run check:release` for local verification.

**Links to fill after publication:** Public repository: pending. Public demo: pending. Video: on hold at the builder's request. Final developer experience report: builder to write in their own words from `DEV_EXPERIENCE_NOTES.md`.

**Claim limits:** Contract bytecode, name, and symbol checks do not verify offchain backing. Binance market and company data are provider reports, not official exchange quotes. Wallet lookup covers a subset. The catalog is a dated snapshot. See `CLAIMS.md` and `docs/submission/TESTING-STATUS.md`.
