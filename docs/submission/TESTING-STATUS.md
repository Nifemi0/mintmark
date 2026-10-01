# Mintmark testing status

Checked 1 October 2026. This file records both local checks and the public production deployment.

| Check | Status | Evidence and limit |
| --- | --- | --- |
| Automated tests | Pass | `npm test`: 21 passing, 0 failing. Identity, catalog coverage, deployment handler, Binance signing/retry, reports, wallet matching, and history are covered. |
| Clean copy without credentials | Pass | Copied distributable files to a new directory, ran `npm test` and `npm run check:release`, then started the app without `.env.local` on port 4174. NVDA returned Ondo, bStocks, and xStocks records; xStocks returned an explicit identity-only report. |
| Fresh local Git clone | Pass | Cloned the standalone Mintmark repository from the hosting commit without `.env.local`; `npm test` passed 21/21 and `npm run check:release` passed. The clone served 1,565 records, three NVDA search results, and the local NVIDIA logo without credentials. |
| BSC contract identity | Pass at snapshot time | `npm run sync` checked bytecode and ERC-20 name/symbol for the 1,565 contracts in `data/catalog.json`. This does not verify offchain backing or legal rights. |
| Priority searches | Pass | NVIDIA and TSLA each show three provider contracts; AAPL shows Ondo and xStocks. Each visible row links its exact contract and provider legal-document hub. |
| Live Binance RWA reports | Pass with configured credentials | Exact-contract reports returned company and market data for sampled Ondo and bStocks records. A temporary HTTP 429 was observed and bounded retry added. These reports are not exchange quotes or independent custody checks. |
| xStocks detailed reports | Unavailable by design | Mintmark has not verified a matching company/market/price source for exact xStocks contracts. The UI states this instead of borrowing another provider's data. |
| Wallet lookup | Limited | Read-only lookup checks 24 enabled Ondo BSC contracts. It does not scan every wallet token or every registry contract. |
| Desktop and mobile browser flow | Pass | Headless Chromium verified NVDA (3 rows), TSLA (3), and AAPL (2), legal links and record dialogs at 1440px and 390px. No page errors or horizontal overflow were observed. |
| Priority legal-document URLs | Partially verified | Ondo and Backed legal-document hubs returned HTTP 200. Binance's legal-document URL returned HTTP 202 to an automated request; a human browser content check is still needed. These hubs do not prove that individual token terms were reviewed. |
| Private credentials in distributable text | Pass | `.env.example` contains placeholders; `npm run check:release` found no configured private credential values in distributable text files. `.env.local` is ignored. |
| Public repository | Pass | [github.com/Nifemi0/mintmark](https://github.com/Nifemi0/mintmark) is public, and the local `main` branch tracks `origin/main`. |
| Public demo | Pass | [mintmark.nuvixes.studio](https://mintmark.nuvixes.studio) is the verified production domain with an automatically renewing TLS certificate. Its page, assets, logo, API health, search, live Binance-backed reports, supported wallet lookup, xStocks unavailable report, and history responded. NVIDIA and TSLA each returned three providers; AAPL returned two. |
| Production browser flow | Pass | Chrome 154 checked the live site at 1440×900 and 390×844. NVIDIA returned three products with live Ondo and bStocks reports; TSLA returned three, AAPL two, and an exact contract one. Evidence expansion, history, URL state, Escape close, explicit xStocks unavailability, malformed-wallet handling, and the public 18-holding example passed. No horizontal overflow, broken images, console exceptions, failed requests, or HTTP errors were observed. Screenshots are saved in `docs/qa-production-*.png`; the reproducible CDP flow is `scripts/qa-production-cdp.mjs`. |
| Vercel hosting package | Pass | Production bundle contains the catalog and history snapshots and no `.env` file or private-key value. Credentials are encrypted Vercel variables. The public API reports 1,565 records, `binanceConfigured=true`, and execution in Cape Town (`cpt1`). |
| Public company reports | Pass for Ondo and bStocks | The production API returned exact-contract NVIDIA company reports for Ondo and bStocks with HTTP 200. The Washington, D.C. deployment and US VPS previously returned Binance code `40304`; moving the Vercel function to Cape Town resolved it. xStocks remains explicitly identity-only. |
| Demo video | Outline ready; recording pending | `docs/submission/DEMO-OUTLINE.md` fits the official four-minute maximum. No video has been recorded or published. |
| Developer experience report | Builder action pending | `docs/submission/DEVEX-REPORT-WORKSHEET.md` maps the official fields to recorded facts. The event rejects AI-generated reports, so the builder must confirm ratings and write the final narrative answers in their own words. |

The [official BNB Hack brief](https://www.bnbchain.org/en/hackathons/tokenized-stocks) requires a public repository and a deployed link or reproducible judge instructions. The submission window closes 11 October 2026 at 12:00 UTC.
