# Mintmark developer experience report worksheet

The official report says perfunctory or AI-generated reports are not accepted. This worksheet preserves the exact engineering facts and observed API behavior. The builder must confirm the multiple-choice answers and rewrite the narrative fields in their own voice before submitting the separate Google Form.

## Builder details

- **Team or project name:** Mintmark
- **Contact email:** `[BUILDER INPUT REQUIRED — use the registration email]`
- **Public repository URL:** https://github.com/Nifemi0/mintmark
- **Modules actually called:** RWA Data API; Market API; Wallet API
- **Team size:** Solo
- **Most experienced team member's Web3 experience:** 1 to 3 years
- **Previous Binance Web3 API experience:** Yes, tried it briefly

## Onboarding

- **Time from opening the docs to the first successful API call:** Under 15 minutes
- **Time to receive a working API key:** Under 15 minutes
- **Overall onboarding rating:** 5
- **Where the implementation got stuck:**
  - Request signing required the complete `/build/api/v1/...` path in the pre-hash, including the encoded query. Omitting `/build` produces an invalid signature.
  - A host clock about four seconds behind Binance's HTTP `Date` header caused code `40103` (“timestamp expired”) when network time was included. Sending documented `X-OC-RECV-WINDOW: 60000` made the same request succeed.
  - Correctly signed US-hosted requests returned HTTP 200 with business code `40304` (“Service not available due to compliance restriction”). The same credentials and request worked from Lagos and later from Vercel `cpt1` in Cape Town.
- **Step that took longer than expected:** Distinguishing authentication failure from regional availability. The signature and credentials were valid, but the API used a successful HTTP status with a business error code. The local machine, a US VPS, Vercel Washington, and Vercel Cape Town had to be compared before the cause was clear.
- **Used `llms.txt` or `llms-full.txt`:** Yes. Binance's `llms.txt` was used on 1 October during final integration verification, after the first successful API call. It confirmed the RWA, general Market, candles, and targeted wallet-balance endpoints and linked the authentication and error-code references. Mintmark now also publishes its own `/llms.txt` with product scope, public endpoints, evidence semantics, and limits. Do not imply Binance's file was used during initial onboarding.
- **What an AI coding agent got wrong:** No specific documentation hallucination was recorded. Codex needed the exact authentication page and live responses to settle the `/build` signing path and regional behavior. Rewrite this only if it matches the builder's experience.

## Documentation issues

- **Overall documentation rating:** 5
- **Confirmed documentation errors:** No definite typo or false field definition was recorded. Do not invent one to fill the form.
- **Under-documented topics:**
  - How regional eligibility is enforced at API-request time and how code `40304` differs from a bad key or bad signature.
  - Whether an endpoint can return HTTP 200 while the business request fails, and which field should be treated as authoritative.
  - Practical guidance for choosing `all-token-balances-by-address` versus targeted `token-balances-by-address` when a wallet contains thousands of assets.
  - Exact provenance and coverage differences between Ondo, bStocks, and xStocks rows returned by the RWA surface.
  - Recommended clock-skew diagnostics and receive-window values for signed server workloads.
- **Were code examples runnable as written?:** `[BUILDER INPUT REQUIRED — the notes do not record a controlled example-by-example test]`
- **Examples that failed:** Leave blank unless the builder personally ran an official example that failed.
- **Most useful page:** https://web3.binance.com/en/dev-docs/authentication

## API pitfalls

- **Reliability and stability rating:** 4
- **Unexpected behavior and edge cases:**
  - `GET /api/v1/dex/market/rwa/tokens?binanceChainId=56` initially returned 488 rows in about 2.8 seconds. Exact-contract reconciliation found display-name differences that were not identity conflicts.
  - `GET /api/v1/dex/balance/all-token-balances-by-address` returned 2,000 unrelated tokens across the first 20 pages for a known AAPLon holder and still did not reach AAPLon. Mintmark changed to `POST /api/v1/dex/balance/token-balances-by-address` with exact contracts in batches of 20; the targeted response returned AAPLon and 18 supported positive holdings for the public example.
  - `GET /api/v1/dex/market/rwa/underlying-profile`, `underlying-market`, and the candles route worked for exact Ondo and bStocks contracts. `POST /api/v1/dex/market/price-info` returned exact-contract token-market fields for sampled Ondo, bStocks, and xStocks contracts. The xStocks underlying-company report remains unavailable instead of reusing another product's figures.
  - Sample Market API responses contained large 24-hour volume with zero transactions, and liquidity was sometimes absent or reported as zero. Mintmark preserves those values and flags the discrepancy rather than inferring depth.
  - Three Ondo onchain names differed from the issuer CSV beyond whitespace, 13 bStocks names differed beyond the generic provider suffix, and eight checked Ondo contracts were absent from one Binance RWA response. Mintmark preserves these as source differences or third-party gaps.
- **Unclear errors:**
  - Exact message: `Service not available due to compliance restriction`, business code `40304`, returned with HTTP 200 by RWA list and underlying-profile requests from Vercel Washington and a US VPS. It did not state that the credentials and signature were valid or point directly to the supported-region policy.
  - Exact failure: code `40103` (`timestamp expired`) on a signed targeted wallet-balance request. The request was only a few seconds outside the server's clock; `X-OC-RECV-WINDOW: 60000` resolved it.
- **Latency:** The recorded RWA token-list call took about 2.8 seconds. No controlled latency range or median was recorded for other endpoints, so do not describe them as slow without measuring again.
- **Rate limits:** Yes, occasionally. One temporary HTTP 429 occurred while fetching live data. Mintmark added bounded retry with `Retry-After` support and at most three attempts.
- **Authentication and signing:** The pre-hash is `timestamp + method + /build path with query + body`. Timestamp tolerance and the receive-window header mattered in practice. Private keys stayed server-side.
- **Data that required reconciliation:** Provider display names, onchain ERC-20 names, Binance product names, and catalog coverage differed. Mintmark treats contract + chain as identity, retains each source separately, and never resolves a discrepancy by ticker alone.

## AI stack feedback

- **Parts used:** None of Agentic Wallet, Wallet Skills, Wallet Skills CLI, or BNB Agent Studio were used.
- **Overall rating:** N/A, did not use it.
- **What worked well:** N/A.
- **What did not work:** N/A; do not claim failures for components that were not tested.
- **What is missing:** A read-only skill that resolves a company name to every exact BSC token representation, returns evidence and provider terms, and refuses to treat a ticker match as product identity would have fit Mintmark's workflow. This is a requested capability, not a tested defect.
- **BNB Agent Studio:** N/A.

## Tokenized-stock specifics

- **Platforms used:** Ondo, bStocks, and xStocks.
- **Liquidity depth:** Not independently measured. Mintmark displays the exact-contract liquidity field reported by Binance when present, but did not request executable quotes or test market depth.
- **Slippage:** Not measured; no trade was submitted.
- **Outside-market-hours behavior:** Not measured as a controlled study. The product does not make a claim about weekend or overnight price behavior.
- **Onchain versus reference-price spread:** The fields were displayed separately where Binance supplied them, but Mintmark did not record a spread time series or test whether a gap was actionable.
- **Practical representation differences:**
  - The same NVIDIA underlying appears as Ondo `NVDAon`, bStocks `NVDAB`, and xStocks `NVDAx`, each with a different BSC contract and issuer source.
  - Binance RWA data supplied exact-contract company and underlying-market reports for sampled Ondo and bStocks records. General Market data supplied exact-contract token fields for all three sampled providers; no matching RWA company-report source was verified for xStocks.
  - Provider-published names and ERC-20 names can differ while the contract and symbol still match; these differences remain visible.
  - AAPL has Ondo and xStocks rows in the checked sources, but no bStocks AAPL row. Mintmark does not infer a missing third product.

## Redesign suggestions and requested capabilities

- **First-five-minutes redesign:** Start with one runnable signed request that uses the full `/build` path, prints the pre-hash without secrets, checks local clock skew, and explains HTTP status versus business code. Follow it with a task-based endpoint map: discover an asset, verify an exact contract, fetch company/market data, read known balances, simulate, then transact. Show region eligibility before key creation and expose a diagnostic endpoint that reports whether the caller's region and credentials can use each module.
- **Requested endpoints and tooling:**
  - A typed TypeScript SDK with signature generation, receive-window defaults, retries, and structured business errors.
  - An exact-contract lookup endpoint returning product identity, provider source, terms URL, source timestamps, and explicit unavailable fields.
  - A batch RWA endpoint for many contracts, avoiding one profile/market request per record.
  - Cursor-based wallet pagination with total counts and a documented way to query known contracts efficiently.
  - A capability/region diagnostic that separates unsupported region, invalid key, invalid signature, and clock-skew failures.
  - Provenance fields explaining whether each value came from an issuer, onchain observation, Binance normalization, or another third party.
- **One change that would have saved the most time:** A copy-paste signing reference implementation paired with a diagnostic response that explicitly distinguishes regional compliance code `40304` from authentication and signature failures.
- **Will you keep building?:** Yes, definitely
- **Why?:** Suggested factual basis: the registry already normalizes 1,565 contracts across three providers, but scheduled refreshes, broader wallet coverage, correction workflows, and exact-contract report coverage remain useful follow-on work.
- **Anything else:** The strongest part of the API for this project was the ability to join token identity, company context, market fields, candles, and targeted balances. The largest trust gap was provenance: users and builders need to know which facts came from the issuer, the contract, or Binance's aggregation layer.

## Builder completion checklist

- [ ] Fill the contact email directly in the private form.
- [x] Confirm the team background, onboarding times, and ratings.
- [ ] Confirm whether official examples and `llms.txt` were actually used.
- [ ] Rewrite every narrative response in the builder's own voice.
- [ ] Remove any observation the builder cannot personally stand behind.
- [ ] Submit this report separately before the main project form.
