# Mintmark testing status

Checked 30 September 2026. This file records both local checks and the public production deployment.

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
| Public repository | Pending | A separate local repository has a release commit; no remote or public URL is claimed here. |
| Public demo | Pass for core registry | [mintmark-ecru.vercel.app](https://mintmark-ecru.vercel.app) is a Ready production deployment. Its page, assets, logo, API health, search, xStocks unavailable report, and history responded. NVIDIA and TSLA each returned three providers; AAPL returned two. |
| Production browser flow | Pass | Chrome checked NVIDIA search, three comparison rows, record dialog loading, Escape close, and no page errors or horizontal overflow at 1440px and 390px. |
| Vercel hosting package | Pass for core registry | Production bundle contains the catalog and history snapshots, no `.env` file, and no configured private-key value. The public API reports 1,565 records and `binanceConfigured=false`. |
| Public company reports | Blocked by provider compliance response | The existing credentials returned a sourced NVDA Ondo report locally. With the same credentials stored as encrypted Vercel production variables, Binance returned business code `40304`: “Service not available due to compliance restriction.” The keys were removed and the public registry was redeployed without them. Ondo and bStocks reports remain unavailable publicly; xStocks remains identity-only. |
| Demo video | On hold | The user asked to finish and confirm the features before video work. The event lists video as strongly recommended but optional. |
| Developer experience report | Builder action pending | Factual engineering notes are in `DEV_EXPERIENCE_NOTES.md`. The final report must be written by the builder in their own words. |

The [official BNB Hack brief](https://www.bnbchain.org/en/hackathons/tokenized-stocks) requires a public repository and a deployed link or reproducible judge instructions. The submission window closes 11 October 2026 at 12:00 UTC.
