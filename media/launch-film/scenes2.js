// Acts after the opening: search, evidence, look-alike, daily report, API,
// wallet and routes, outro. Times are absolute film seconds, synced to the
// voice-over cues in audio/cues.json.
(() => {
  const css = `
  #act2 { position: absolute; inset: 0; overflow: hidden; }
  #act2 .sc { position: absolute; inset: 0; display: none; }
  .k2 { font: 500 22px var(--mono); letter-spacing: .3em; text-transform: uppercase; color: var(--mint); }
  .h2x { font: 700 96px/1.02 var(--display); letter-spacing: -0.045em; }
  .glass { background: linear-gradient(160deg, rgba(28,44,36,.92), rgba(14,22,18,.92)); border: 1.5px solid #2c4236; border-radius: 30px; box-shadow: 0 40px 140px rgba(0,0,0,.6); }
  .badge { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 99px; font: 500 20px var(--mono); letter-spacing: .1em; text-transform: uppercase; }
  .b-ondo { background: #1f3229; color: #8fc497; } .b-bstock { background: #3a2e10; color: #f3ba2f; } .b-xstock { background: #263330; color: #d6e6da; }
  /* search */
  #srch { position: absolute; left: 50%; width: 1120px; height: 116px; margin-left: -560px; border-radius: 58px; display: flex; align-items: center; gap: 26px; padding: 0 44px; font: 500 52px var(--display); }
  #srch .mag { width: 40px; height: 40px; border: 5px solid var(--mint); border-radius: 50%; position: relative; flex: none; }
  #srch .mag:after { content: ''; position: absolute; width: 18px; height: 5px; background: var(--mint); right: -14px; bottom: -6px; transform: rotate(45deg); border-radius: 3px; }
  #srch .caret { display: inline-block; width: 4px; height: 56px; background: var(--mint2); margin-left: 4px; vertical-align: middle; }
  #srchHead { position: absolute; left: 210px; top: 250px; display: flex; align-items: baseline; gap: 26px; }
  #srchHead b { font: 700 72px var(--display); letter-spacing: -0.04em; }
  #srchHead span { font: 500 26px var(--mono); color: var(--muted); letter-spacing: .12em; }
  .row { position: absolute; left: 210px; width: 1500px; height: 156px; display: flex; align-items: center; gap: 46px; padding: 0 42px; }
  .row .sym { font: 700 64px var(--display); letter-spacing: -0.035em; width: 300px; }
  .row .meta { display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .row .addr { font: 500 30px var(--mono); white-space: pre; position: relative; display: inline-block; }
  .row .addr i { position: absolute; left: 0; bottom: -8px; height: 4px; background: var(--mint); border-radius: 4px; width: 0; }
  .row .iss { font: 400 24px var(--body); color: var(--muted); }
  .row .chk { font: 500 24px var(--body); color: var(--mint); }
  /* evidence */
  #evTitle { position: absolute; left: 0; right: 0; top: 96px; text-align: center; }
  #evTitle span { display: inline-block; margin: 0 14px; }
  #rec { position: absolute; left: 50%; top: 250px; width: 1400px; height: 700px; margin-left: -700px; padding: 46px 56px; transform-style: preserve-3d; }
  #rec .top { display: flex; align-items: center; gap: 26px; }
  #rec .top b { font: 700 70px var(--display); letter-spacing: -0.04em; }
  #rec .top span.nm { font: 400 30px var(--body); color: var(--muted); }
  #rec .ca { margin-top: 16px; font: 500 28px var(--mono); color: var(--ink); white-space: pre; }
  .claim { position: absolute; left: 56px; right: 56px; height: 104px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #2c4236; }
  .claim .what { font: 500 34px var(--body); }
  .claim .src { font: 500 22px var(--mono); color: var(--quiet); letter-spacing: .06em; margin-top: 6px; }
  .stamp2 { padding: 12px 22px; border-radius: 12px; border: 4px solid; font: 700 30px var(--display); letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
  /* look-alike */
  #lkIn { position: absolute; left: 50%; top: 190px; width: 1300px; height: 120px; margin-left: -650px; border-radius: 24px; display: flex; align-items: center; padding: 0 40px; gap: 26px; font: 500 38px var(--mono); }
  #lkIn .lab { font: 500 22px var(--mono); color: var(--quiet); letter-spacing: .18em; }
  #lkIn .val { white-space: pre; padding: 4px 8px; border-radius: 8px; }
  #lkKey { position: absolute; left: 50%; top: 340px; margin-left: -60px; padding: 14px 22px; border-radius: 14px; background: #1f3229; color: var(--mint2); font: 700 34px var(--mono); }
  #lkScan { position: absolute; left: 260px; right: 260px; top: 380px; height: 300px; }
  #lkScan .cell { position: absolute; width: 46px; height: 46px; border-radius: 9px; border: 1.5px solid #2c4236; }
  #lkScan .beam { position: absolute; top: -20px; bottom: -20px; width: 6px; background: var(--mint2); box-shadow: 0 0 40px 10px rgba(143,196,151,.6); border-radius: 6px; }
  #lkScan .read { position: absolute; left: 0; right: 0; bottom: -86px; text-align: center; font: 500 30px var(--mono); color: var(--muted); white-space: pre; }
  .cmp { position: absolute; top: 470px; width: 640px; height: 290px; padding: 36px 40px; }
  .cmp .t1 { font: 500 20px var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--quiet); }
  .cmp .t2 { margin-top: 16px; font: 700 64px var(--display); letter-spacing: -0.03em; }
  .cmp .t3 { margin-top: 18px; font: 500 30px var(--mono); white-space: pre; }
  .cmp .t3 em { font-style: normal; color: #ff8a5c; background: rgba(255,90,50,.18); border-radius: 4px; }
  #alarm { position: absolute; left: 50%; top: 830px; width: 1180px; margin-left: -590px; padding: 30px 40px; border-radius: 24px; background: linear-gradient(90deg, #4a160b, #2a0f08); border: 3px solid #ff8a5c; display: flex; align-items: center; gap: 30px; }
  #alarm .ic { width: 70px; height: 70px; border-radius: 50%; background: #ff8a5c; color: #2a0f08; display: grid; place-items: center; font: 700 46px var(--display); flex: none; }
  #alarm b { font: 700 48px var(--display); letter-spacing: -0.02em; }
  #alarm span { display: block; font: 400 26px var(--body); color: #ffc7ad; margin-top: 4px; }
  /* report */
  #sun { position: absolute; left: -10%; right: -10%; top: -60%; height: 120%; background: radial-gradient(ellipse at 50% 100%, rgba(243,186,47,.28), rgba(143,196,151,.08) 40%, transparent 65%); }
  #cal { position: absolute; left: 190px; top: 210px; width: 330px; height: 380px; perspective: 900px; }
  #cal .pg { position: absolute; inset: 0; border-radius: 30px; background: #f2f6f2; color: #111a18; display: flex; flex-direction: column; align-items: center; justify-content: center; backface-visibility: hidden; transform-origin: 50% 0; }
  #cal .pg .m { font: 700 34px var(--mono); letter-spacing: .2em; color: #4f8a5a; }
  #cal .pg .d { font: 700 190px/1 var(--display); letter-spacing: -0.06em; }
  #hub { position: absolute; left: 190px; top: 690px; width: 330px; text-align: center; font: 500 24px var(--mono); color: var(--muted); letter-spacing: .14em; }
  #provs { position: absolute; left: 190px; top: 760px; width: 330px; display: flex; justify-content: space-between; }
  #feed { position: absolute; left: 640px; top: 170px; width: 1090px; height: 760px; padding: 40px 46px; overflow: hidden; }
  #feed .hd { font: 500 22px var(--mono); letter-spacing: .18em; color: var(--quiet); text-transform: uppercase; }
  #feed .hl { margin-top: 12px; font: 700 54px/1.1 var(--display); letter-spacing: -0.035em; }
  .item { position: absolute; left: 46px; right: 46px; height: 82px; display: flex; align-items: center; gap: 26px; border-top: 1px solid #2c4236; font: 400 28px var(--body); }
  .item .tag { width: 150px; font: 500 21px var(--mono); letter-spacing: .1em; text-transform: uppercase; }
  .item .sym { width: 170px; font: 700 32px var(--display); }
  .chips { position: absolute; left: 640px; top: 950px; display: flex; gap: 22px; }
  .chip { padding: 14px 26px; border-radius: 99px; border: 2px solid #2c4236; font: 600 28px var(--display); color: var(--muted); }
  /* api */
  .app { position: absolute; width: 250px; height: 250px; border-radius: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; font: 600 28px var(--display); }
  .app .ico { width: 92px; height: 92px; border-radius: 26px; display: grid; place-items: center; font: 700 52px var(--display); color: #0b130f; }
  #ed { position: absolute; left: 50%; top: 165px; width: 1500px; height: 690px; margin-left: -750px; overflow: hidden; }
  #ed .bar { height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 26px; border-bottom: 1px solid #2c4236; }
  #ed .bar i { width: 15px; height: 15px; border-radius: 50%; background: #3b5245; display: inline-block; }
  #ed .bar span { margin-left: 18px; font: 500 22px var(--mono); color: var(--quiet); }
  #ed pre { position: absolute; left: 40px; top: 96px; width: 700px; font: 500 30px/1.55 var(--mono); color: var(--ink); white-space: pre; }
  #ed pre .k { color: #f3ba2f; } #ed pre .s { color: var(--mint2); } #ed pre .p { color: #9fb7ff; }
  #ed .resp { position: absolute; left: 790px; top: 64px; right: 0; bottom: 0; border-left: 1px solid #2c4236; overflow: hidden; }
  #ed .resp .ln { position: absolute; left: 34px; right: 30px; height: 46px; display: flex; gap: 20px; align-items: center; font: 500 23px var(--mono); }
  #ed .cnt { position: absolute; right: 30px; top: 16px; font: 700 26px var(--mono); color: var(--mint2); }
  #apiWords { position: absolute; left: 0; right: 0; top: 900px; display: flex; justify-content: center; gap: 30px; }
  #apiWords span { padding: 16px 30px; border-radius: 99px; background: #1f3229; color: var(--mint2); font: 700 38px var(--display); letter-spacing: -0.01em; }
  /* wallet */
  #wal { position: absolute; left: 150px; top: 200px; width: 700px; height: 690px; padding: 40px 44px; }
  #wal .hd { font: 500 22px var(--mono); letter-spacing: .18em; color: var(--quiet); }
  #wal .ad { margin-top: 12px; font: 500 30px var(--mono); }
  .hold { position: absolute; left: 44px; right: 44px; height: 92px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #2c4236; }
  .hold b { font: 700 38px var(--display); } .hold span { font: 500 26px var(--mono); color: var(--muted); }
  .hold .ok { color: var(--mint); font: 500 24px var(--body); }
  .node { position: absolute; width: 520px; padding: 30px 36px; }
  .node .t1 { font: 500 20px var(--mono); letter-spacing: .16em; color: var(--quiet); text-transform: uppercase; }
  .node .t2 { margin-top: 10px; font: 700 46px var(--display); letter-spacing: -0.03em; }
  .node .t3 { margin-top: 8px; font: 400 24px var(--body); color: var(--muted); }
  #routeSvg { position: absolute; inset: 0; }
  /* outro */
  #outTag { position: absolute; left: 0; right: 0; top: 650px; text-align: center; font: 600 64px var(--display); letter-spacing: -0.03em; }
  #outTag span { display: inline-block; margin: 0 9px; }
  #outUrl { position: absolute; left: 0; right: 0; top: 780px; text-align: center; font: 500 40px var(--mono); color: var(--mint2); white-space: pre; }
  #outFoot { position: absolute; left: 0; right: 0; top: 880px; text-align: center; font: 500 22px var(--mono); letter-spacing: .3em; color: var(--quiet); text-transform: uppercase; }
  #black { position: absolute; inset: 0; background: #000; opacity: 0; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const act = document.createElement('div'); act.id = 'act2';
  act.innerHTML = `
  <div class="sc" id="sA">
    <div id="srch" class="glass"><div class="mag"></div><span id="srchTxt"></span><span class="caret" id="srchCaret"></span></div>
    <div id="srchHead"><b>NVIDIA</b><span id="srchCount"></span></div>
    <div id="rows"></div>
  </div>
  <div class="sc" id="sB">
    <div id="evTitle" class="h2x"><span>Every</span><span>claim</span><span>carries</span><span>its</span><span style="color:var(--mint)">proof.</span></div>
    <div id="rec" class="glass">
      <div class="top"><span class="badge b-ondo">Ondo</span><b>NVDAon</b><span class="nm">NVIDIA (Ondo Tokenized)</span></div>
      <div class="ca" id="recCa"></div>
      <div id="claims"></div>
    </div>
  </div>
  <div class="sc" id="sC">
    <div id="lkIn" class="glass"><span class="lab">CONTRACT</span><span class="val" id="lkVal"></span></div>
    <div id="lkKey">⌘ V</div>
    <div id="lkScan"><div class="beam" id="lkBeam"></div><div class="read" id="lkRead"></div></div>
    <div class="cmp glass" id="cmpReal" style="left:260px"><div class="t1">Registered · Ondo</div><div class="t2">NVDAon</div><div class="t3" id="cmpRealA"></div></div>
    <div class="cmp glass" id="cmpFake" style="left:1020px;border-color:#ff8a5c"><div class="t1" style="color:#ff8a5c">This contract</div><div class="t2">NVDAon</div><div class="t3" id="cmpFakeA"></div></div>
    <div id="alarm"><div class="ic">!</div><div><b>Look-alike detected</b><span>Same symbol as a registered product. Different contract.</span></div></div>
  </div>
  <div class="sc" id="sD">
    <div id="sun"></div>
    <div id="cal"></div>
    <div id="hub">CHECKING PROVIDERS</div>
    <div id="provs"><span class="badge b-ondo" id="pv0">Ondo</span><span class="badge b-bstock" id="pv1">bStocks</span><span class="badge b-xstock" id="pv2">xStocks</span></div>
    <div id="feed" class="glass"><div class="hd" id="feedHd">Daily reports · 13–19 November 2026</div><div class="hl" id="feedHl">This week: 68 new tokens, 4 halts, 1 removal.</div><div id="items"></div></div>
    <div class="chips"><span class="chip" id="ch0">+68 new listings</span><span class="chip" id="ch1">4 halts</span><span class="chip" id="ch2">1 removal</span></div>
  </div>
  <div class="sc" id="sE">
    <div class="app glass" id="ap0"><div class="ico" style="background:#8fc497">◈</div>Wallet</div>
    <div class="app glass" id="ap1"><div class="ico" style="background:#f3ba2f">%</div>Lending</div>
    <div class="app glass" id="ap2"><div class="ico" style="background:#d6e6da">▤</div>Portfolio</div>
    <div id="ed" class="glass"><div class="bar"><i></i><i></i><i></i><span>mintmark.nuvixes.studio/v1</span></div><pre id="code"></pre><div class="resp" id="resp"><div class="cnt" id="respCnt"></div></div></div>
    <div id="apiWords"><span id="aw0">Free</span><span id="aw1">Open</span><span id="aw2">Built to be relied on</span></div>
  </div>
  <div class="sc" id="sF">
    <svg id="routeSvg" viewBox="0 0 1920 1080"></svg>
    <div id="wal" class="glass"><div class="hd">WALLET</div><div class="ad" id="walAd"></div><div id="holds"></div></div>
    <div class="node glass" id="nd0" style="left:1200px;top:250px"><div class="t1">Verified route</div><div class="t2">Binance Spot</div><div class="t3">NVDAB / USDT pair listed</div></div>
    <div class="node glass" id="nd1" style="left:1200px;top:620px"><div class="t1">Verified route</div><div class="t2">PancakeSwap</div><div class="t3">NVDAB pool · $1.5M liquidity</div></div>
  </div>
  <div class="sc" id="sG">
    <div id="outTag"><span>Know</span><span>the</span><span>token</span><span>before</span><span>you</span><span style="color:var(--mint)">trust</span><span style="color:var(--mint)">it.</span></div>
    <div id="outUrl"></div>
    <div id="outFoot">Free registry · Daily report · API v1</div>
  </div>
  <div id="black"></div>`;
  document.getElementById('stage').insertBefore(act, document.getElementById('redflash'));

  const G = (id) => document.getElementById(id);
  const show = (id, T, a, b) => { const on = T >= a && T < b; G(id).style.display = on ? 'block' : 'none'; return on; };
  const pop = (el, T, t0, { from = 1.8, dur = 0.4, y = 0 } = {}) => {
    const p = easeOutExpo(span(T, t0, t0 + dur));
    el.style.opacity = span(T, t0, t0 + 0.06);
    el.style.transform = `translateY(${(1 - p) * y}px) scale(${lerp(from, 1, p)})`;
    el.style.filter = `blur(${((1 - p) * 14).toFixed(2)}px)`;
  };
  const rise = (el, T, t0, dur = 0.7, dist = 60) => { const p = easeOutExpo(span(T, t0, t0 + dur)); el.style.opacity = span(T, t0, t0 + 0.15); el.style.transform = `translateY(${(1 - p) * dist}px)`; return p; };
  const N = D.nvda;
  const PROV = ['ondo', 'bstock', 'xstock'];

  // ---- A: search ----
  const rows = N.map((n, i) => {
    const el = document.createElement('div'); el.className = 'row glass';
    el.innerHTML = `<span class="badge b-${PROV[i]}" style="width:170px;justify-content:center">${n.provider}</span><div class="sym">${n.symbol}</div><div class="meta"><span class="addr"><span></span><i></i></span><span class="iss">${n.issuer}</span></div><span class="chk">✓ Checked</span>`;
    G('rows').appendChild(el); return { el, addr: el.querySelector('.addr span'), ul: el.querySelector('.addr i'), full: n.address };
  });
  // ---- B: evidence ----
  const CLAIMS = [
    ['Contract bytecode, name and symbol', 'READ FROM BNB CHAIN', 'Onchain observed', '#8fc497', 'rgba(143,196,151,.14)'],
    ['Listed in Ondo’s published token list', 'DOCS.ONDO.FINANCE', 'Issuer published', '#9fb7ff', 'rgba(159,183,255,.14)'],
    ['Price, volume and holders', 'BINANCE WEB3 API', 'Third-party reported', '#f3ba2f', 'rgba(243,186,47,.14)'],
    ['Shares held by the custodian', 'NO INDEPENDENT CHECK', 'Unverified', '#93a797', 'rgba(147,167,151,.1)'],
  ];
  const claims = CLAIMS.map(([what, src, label, col, bg], i) => {
    const el = document.createElement('div'); el.className = 'claim'; el.style.top = `${200 + i * 112}px`;
    el.innerHTML = `<div><div class="what">${what}</div><div class="src">${src}</div></div><div class="stamp2" style="color:${col};border-color:${col};background:${bg}">${label}</div>`;
    G('claims').appendChild(el); return { el, stamp: el.querySelector('.stamp2') };
  });
  const evWords = [...G('evTitle').children];
  // ---- C: look-alike ----
  const FAKE = '0x9d41b7e2a0c35e8b1f04d6a27c935f12c8e3a1d7', REAL = N[0].address;
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 24; c++) { const el = document.createElement('div'); el.className = 'cell'; el.style.left = `${c * 58}px`; el.style.top = `${r * 64}px`; G('lkScan').appendChild(el); cells.push({ el, c, r }); }
  const diff = (a, b) => [...a].map((ch, i) => (ch === b[i] ? ch : `<em>${ch}</em>`)).join('');
  const shortA = (a) => `${a.slice(0, 14)}…${a.slice(-10)}`;
  G('cmpRealA').innerHTML = shortA(REAL);
  G('cmpFakeA').innerHTML = diff(shortA(FAKE), shortA(REAL));
  // ---- D: report ----
  const days = [13, 14, 15, 16, 17, 18, 19];
  G('cal').innerHTML = days.map((d) => `<div class="pg"><div class="m">NOV 2026</div><div class="d">${d}</div></div>`).join('');
  const pages = [...G('cal').children];
  const ITEMS = [
    ['Added', 'URNMx', 'Sprott Uranium Miners ETF · xStocks', '#8fc497'],
    ['Halted', 'KVUEx', 'Kenvue · xStocks marked halted', '#f3ba2f'],
    ['Added', 'BNTXon', 'BioNTech SE · Ondo', '#8fc497'],
    ['Halted', 'SNDKx', 'Sandisk · xStocks marked halted', '#f3ba2f'],
    ['Removed', 'IEPx', 'Icahn Enterprises · no longer listed', '#ff8a5c'],
    ['Added', 'GRMNx', 'Garmin · xStocks', '#8fc497'],
  ];
  const items = ITEMS.map(([tag, sym, desc, col], i) => {
    const el = document.createElement('div'); el.className = 'item'; el.style.top = `${200 + i * 92}px`;
    el.innerHTML = `<span class="tag" style="color:${col}">${tag}</span><span class="sym">${sym}</span><span style="color:var(--muted)">${desc}</span>`;
    G('items').appendChild(el); return el;
  });
  // ---- E: api ----
  const CODE = [
    ['<span class="k">POST</span> <span class="p">/v1/tokens/lookup</span>', 'POST /v1/tokens/lookup'],
    ['', ''],
    ['{', '{'],
    ['  <span class="s">"addresses"</span>: [', '  "addresses": ['],
    ['    <span class="s">"0xa9ee…6f75"</span>,', '    "0xa9ee…6f75",'],
    ['    <span class="s">"0x02fc…7436"</span>,', '    "0x02fc…7436",'],
    ['    <span class="s">"0xc845…849d"</span>,', '    "0xc845…849d",'],
    ['    <span class="p">… 97 more</span>', '    … 97 more'],
    ['  ]', '  ]'],
    ['}', '}'],
  ];
  const codeLen = CODE.reduce((n, [, plain]) => n + plain.length + 1, 0);
  const respSyms = D.symbols.slice(0, 100);
  const respLines = [];
  for (let i = 0; i < 13; i++) { const el = document.createElement('div'); el.className = 'ln'; G('resp').appendChild(el); respLines.push(el); }
  // ---- F: wallet ----
  const HOLD = [['NVDAB', '12.40'], ['SPYon', '3.05'], ['TSLAx', '8.00'], ['QQQon', '1.75']];
  const holds = HOLD.map(([s, b], i) => {
    const el = document.createElement('div'); el.className = 'hold'; el.style.top = `${180 + i * 112}px`;
    el.innerHTML = `<div><b>${s}</b></div><span class="bal"></span><span class="ok">✓ exact contract</span>`;
    G('holds').appendChild(el); return { el, bal: el.querySelector('.bal'), val: Number(b) };
  });
  const svgNS = 'http://www.w3.org/2000/svg';
  const routes = [[0, 300], [1, 670]].map(([i, y]) => {
    const path = document.createElementNS(svgNS, 'path');
    const d = `M 850 ${292} C 1000 ${292}, 1060 ${y + 60}, 1200 ${y + 60}`;
    path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', i === 0 ? '#f3ba2f' : '#8fc497'); path.setAttribute('stroke-width', '4');
    G('routeSvg').appendChild(path);
    const dot = document.createElementNS(svgNS, 'circle'); dot.setAttribute('r', '9'); dot.setAttribute('fill', '#fff');
    dot.style.filter = `drop-shadow(0 0 12px ${i === 0 ? '#f3ba2f' : '#8fc497'})`; G('routeSvg').appendChild(dot);
    const len = path.getTotalLength(); path.style.strokeDasharray = `${len}`;
    return { path, dot, len };
  });
  const outWords = [...G('outTag').children];

  // ---- outro particles reuse the opening's particle field ----
  function drawOutro(T) {
    const c = document.getElementById('fx').getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080);
    const conv = span(T, 74.0, 75.4);
    const fadeOut = 1 - span(T, 75.3, 75.8);
    if (conv <= 0 || fadeOut <= 0) return;
    for (let i = 0; i < D.total; i++) {
      const s = hash(i * 1.3 + 5);
      const q = easeInOutExpo(span(T, 74.0 + s * 0.3, 75.1 + s * 0.3));
      const ang = hash(i * 3.1) * Math.PI * 2, rad = 700 + hash(i * 7.7) * 700;
      const lp = logoPoint(i);
      const x = lerp(960 + Math.cos(ang + T) * rad, lp.x, q), y = lerp(540 + Math.sin(ang + T) * rad * 0.6, lp.y, q);
      const col = i < D.counts.ondo ? '143,196,151' : i < D.counts.ondo + D.counts.bstock ? '243,186,47' : '206,226,211';
      c.fillStyle = `rgb(${col})`; c.globalAlpha = fadeOut * span(T, 74.0, 74.3); c.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
    }
    c.globalAlpha = 1;
  }

  const IMPACTS2 = [24.1, 36.05, 37.3, 38.8, 40.1, 47.6, 63.45, 65.2, 65.9, 66.6, 75.2];
  function shake2(T) {
    let x = 0, y = 0;
    for (const ti of IMPACTS2) {
      const d = T - ti; if (d < 0 || d > 0.45) continue;
      const a = Math.exp(-d * 10) * (ti === 47.6 ? 22 : 9), k = Math.floor(T * 60);
      x += (hash(k + ti * 10) - 0.5) * a; y += (hash(k + ti * 20 + 1) - 0.5) * a;
    }
    return { x, y };
  }
  // Camera drift and push for each act, plus enter/exit zooms.
  function actCam(T, a, b) {
    const p = span(T, a, b);
    const enter = easeOutExpo(span(T, a, a + 0.6)), exit = easeInExpo(span(T, b - 0.5, b));
    const s = lerp(1.18, 1, enter) * (1 + 0.04 * p) * (1 + exit * 0.35);
    return { s, o: span(T, a, a + 0.25) * (1 - exit), blur: (1 - enter) * 12 + exit * 16 };
  }
  function applyCam(id, T, a, b) {
    const c = actCam(T, a, b), sh = shake2(T);
    const el = G(id); el.style.transform = `translate(${sh.x.toFixed(2)}px, ${sh.y.toFixed(2)}px) scale(${c.s.toFixed(4)})`;
    el.style.opacity = c.o.toFixed(3); el.style.filter = c.blur > 0.05 ? `blur(${c.blur.toFixed(2)}px)` : 'none';
  }

  window.renderAct2 = (T) => {
    const frame = Math.round(T * 60);
    // A: search 22.2 – 33.7
    if (show('sA', T, 22.2, 33.7)) {
      applyCam('sA', T, 22.2, 33.7);
      const top = lerp(470, 110, easeInOutExpo(span(T, 24.15, 24.8)));
      const sb = G('srch'); sb.style.top = `${top}px`;
      const sp = easeOutBack(span(T, 22.25, 22.9)); sb.style.transform = `scale(${lerp(0.5, 1, clamp(sp, 0, 1.2))})`; sb.style.opacity = span(T, 22.25, 22.4);
      sb.style.boxShadow = `0 0 0 ${2 + 6 * Math.exp(-Math.max(0, T - 24.1) * 6) * (T > 24.1 ? 1 : 0)}px rgba(143,196,151,.6), 0 40px 140px rgba(0,0,0,.6)`;
      const typed = 'NVIDIA'.slice(0, Math.floor(span(T, 23.0, 23.9) * 6.999));
      G('srchTxt').textContent = typed;
      G('srchCaret').style.opacity = T < 24.1 ? (Math.floor(T * 2.4) % 2 ? 0.2 : 1) : 0;
      rise(G('srchHead'), T, 24.5, 0.7, 40);
      G('srchCount').textContent = `${Math.round(easeOutCubic(span(T, 24.6, 25.4)) * 3)} PRODUCTS`;
      const hl = [27.55, 28.2, 28.95];
      const exact = span(T, 29.6, 30.6);
      rows.forEach((r, i) => {
        const p = easeOutExpo(span(T, 24.6 + i * 0.18, 25.5 + i * 0.18));
        const focus = (T >= hl[i] && T < hl[i] + 0.75) ? easeOutExpo(span(T, hl[i], hl[i] + 0.25)) * (1 - span(T, hl[i] + 0.5, hl[i] + 0.75)) : 0;
        const anyFocus = hl.some((h) => T >= h && T < h + 0.75);
        const out = easeInExpo(span(T, 32.7, 33.4));
        const y = 360 + i * 186;
        r.el.style.top = `${y}px`;
        r.el.style.opacity = (span(T, 24.6 + i * 0.18, 24.9 + i * 0.18) * (anyFocus && !focus ? 0.45 : 1) * (i === 0 ? 1 : 1 - out)).toFixed(3);
        r.el.style.transform = `translateX(${(1 - p) * 900 + (i === 0 ? 0 : out * (i === 1 ? -1400 : 1400))}px) scale(${1 + focus * 0.04 + (i === 0 ? out * 0.2 : 0)})`;
        r.el.style.borderColor = focus ? '#8fc497' : '#2c4236';
        r.addr.textContent = scramble(shortA(r.full), span(T, 25.1 + i * 0.2, 26.3 + i * 0.2), frame, i * 41);
        r.ul.style.width = `${easeInOutCubic(span(T, 29.6 + i * 0.15, 30.3 + i * 0.15)) * 100}%`;
        r.addr.parentElement.style.color = exact > 0 && exact < 1 ? 'var(--mint2)' : '';
      });
    }
    // B: evidence 33.5 – 43.4
    if (show('sB', T, 33.5, 43.4)) {
      applyCam('sB', T, 33.5, 43.4);
      const ws = [33.95, 34.25, 34.55, 34.85, 35.05];
      evWords.forEach((w, i) => pop(w, T, ws[i], { from: 2.1, dur: 0.35, y: -30 }));
      const rp = easeOutExpo(span(T, 33.6, 34.6));
      const tilt = easeInExpo(span(T, 42.5, 43.4));
      G('rec').style.transform = `perspective(1600px) translateY(${(1 - rp) * 200}px) rotateX(${(1 - rp) * 30}deg) rotateY(${-tilt * 40}deg) translateX(${-tilt * 900}px)`;
      G('rec').style.opacity = span(T, 33.6, 33.8);
      G('recCa').textContent = scramble(REAL, span(T, 34.0, 35.4), frame, 7);
      const at = [36.05, 37.3, 38.8, 40.1];
      claims.forEach((c, i) => {
        rise(c.el, T, at[i] - 0.35, 0.5, 30);
        const p = easeOutBack(span(T, at[i], at[i] + 0.38));
        c.stamp.style.opacity = span(T, at[i], at[i] + 0.05);
        c.stamp.style.transform = `rotate(${lerp(-18, -3, clamp(p, 0, 1.2))}deg) scale(${lerp(2.6, 1, clamp(p, 0, 1.2))})`;
      });
    }
    // C: look-alike 43.3 – 50.4
    if (show('sC', T, 43.3, 50.4)) {
      applyCam('sC', T, 43.3, 50.4);
      rise(G('lkIn'), T, 43.35, 0.6, 50);
      const pasted = T >= 43.95;
      G('lkVal').textContent = pasted ? FAKE : '';
      G('lkVal').style.background = pasted ? `rgba(143,196,151,${(0.35 * (1 - span(T, 44.0, 44.8))).toFixed(3)})` : 'transparent';
      const kp = easeOutBack(span(T, 43.6, 43.95)); G('lkKey').style.opacity = span(T, 43.6, 43.7) * (1 - span(T, 44.2, 44.5)); G('lkKey').style.transform = `scale(${lerp(1.6, 1, clamp(kp, 0, 1.2)) * (T > 43.95 ? 0.92 : 1)})`;
      const scanOn = T >= 44.5 && T < 46.9;
      G('lkScan').style.opacity = (span(T, 44.5, 44.7) * (1 - span(T, 46.6, 46.9))).toFixed(3);
      const bx = span(T, 44.7, 46.4) * 1380; G('lkBeam').style.left = `${bx}px`;
      cells.forEach(({ el, c, r }) => { const lit = bx > c * 58 && bx - c * 58 < 300; const v = lit ? 1 - (bx - c * 58) / 300 : 0; el.style.background = `rgba(143,196,151,${(v * 0.5).toFixed(3)})`; el.style.borderColor = v > 0 ? '#8fc497' : '#2c4236'; });
      G('lkRead').textContent = scramble('symbol NVDAon · name NVIDIA (Ondo Tokenized)', span(T, 45.3, 46.4), frame, 3);
      [['cmpReal', 46.85, -1], ['cmpFake', 47.0, 1]].forEach(([id, t0, dir]) => { const p = easeOutExpo(span(T, t0, t0 + 0.6)); G(id).style.opacity = span(T, t0, t0 + 0.1); G(id).style.transform = `translateX(${(1 - p) * 500 * dir}px)`; });
      const g = span(T, 47.6, 48.6);
      const ap = easeOutBack(span(T, 47.6, 47.95));
      G('alarm').style.opacity = span(T, 47.6, 47.65);
      G('alarm').style.transform = `scale(${lerp(1.7, 1, clamp(ap, 0, 1.2))}) translateX(${g > 0 && g < 1 ? (hash(frame) - 0.5) * 30 * (1 - g) : 0}px)`;
    }
    // D: daily report 50.3 – 58.5
    if (show('sD', T, 50.3, 58.5)) {
      applyCam('sD', T, 50.3, 58.5);
      G('sun').style.opacity = easeOutCubic(span(T, 50.3, 51.6)).toFixed(3);
      G('sun').style.transform = `translateY(${(1 - easeOutCubic(span(T, 50.3, 51.8))) * 200}px)`;
      rise(G('cal'), T, 50.5, 0.6, 60);
      pages.forEach((pg, i) => {
        const flip = i < pages.length - 1 ? easeInOutCubic(span(T, 50.9 + i * 0.22, 51.12 + i * 0.22)) : 0;
        pg.style.zIndex = String(100 - i); pg.style.transform = `rotateX(${flip * 100}deg)`; pg.style.opacity = flip > 0.95 ? 0 : 1;
      });
      G('hub').style.opacity = span(T, 51.6, 51.9);
      [0, 1, 2].forEach((i) => { const p = easeOutBack(span(T, 51.7 + i * 0.25, 52.1 + i * 0.25)); const ping = Math.exp(-Math.max(0, T - (52.3 + i * 0.25)) * 4) * (T > 52.3 + i * 0.25 ? 1 : 0); const el = G(`pv${i}`); el.style.opacity = span(T, 51.7 + i * 0.25, 51.8 + i * 0.25); el.style.transform = `scale(${clamp(p, 0, 1.2) * (1 + ping * 0.15)})`; el.style.boxShadow = `0 0 ${ping * 40}px rgba(143,196,151,${ping})`; });
      const fp = easeOutExpo(span(T, 53.2, 54.0));
      G('feed').style.opacity = span(T, 53.2, 53.35); G('feed').style.transform = `translateY(${(1 - fp) * 260}px)`;
      items.forEach((el, i) => rise(el, T, 53.7 + i * 0.16, 0.5, 30));
      const chipT = [55.0, 55.95, 56.65], chipC = ['#8fc497', '#f3ba2f', '#ff8a5c'];
      [0, 1, 2].forEach((i) => { const el = G(`ch${i}`); const p = easeOutBack(span(T, chipT[i], chipT[i] + 0.35)); el.style.opacity = span(T, chipT[i] - 0.1, chipT[i]); el.style.transform = `scale(${lerp(1.6, 1, clamp(p, 0, 1.2))})`; const lit = T >= chipT[i]; el.style.borderColor = lit ? chipC[i] : '#2c4236'; el.style.color = lit ? chipC[i] : 'var(--muted)'; });
    }
    // E: API 58.4 – 68.3
    if (show('sE', T, 58.4, 68.3)) {
      applyCam('sE', T, 58.4, 68.3);
      const appT = [59.35, 60.15, 61.3], appX = [440, 835, 1230];
      const gather = easeInOutExpo(span(T, 62.0, 62.6));
      [0, 1, 2].forEach((i) => { const el = G(`ap${i}`); const p = easeOutBack(span(T, appT[i], appT[i] + 0.45)); el.style.left = `${lerp(appX[i], 835, gather)}px`; el.style.top = `${lerp(400, 380, gather)}px`; el.style.opacity = (span(T, appT[i], appT[i] + 0.1) * (1 - gather)).toFixed(3); el.style.transform = `scale(${clamp(p, 0, 1.2) * (1 - gather * 0.6)}) rotate(${(1 - clamp(p, 0, 1)) * -14}deg)`; });
      const ep = easeOutExpo(span(T, 62.3, 63.0));
      G('ed').style.opacity = span(T, 62.3, 62.45); G('ed').style.transform = `perspective(1600px) rotateX(${(1 - ep) * 25}deg) scale(${lerp(0.7, 1, ep)})`;
      const nType = Math.floor(span(T, 62.55, 63.4) * codeLen);
      let left = nType, html = '';
      for (const [rich, plain] of CODE) {
        if (left <= 0) break;
        if (left >= plain.length + 1) { html += rich + '\n'; left -= plain.length + 1; }
        else { html += plain.slice(0, left).replace(/</g, '&lt;') + '<span style="background:var(--mint2);color:#0b130f"> </span>'; left = 0; }
      }
      G('code').innerHTML = html;
      const scroll = span(T, 63.5, 64.7);
      const done = Math.round(easeOutCubic(scroll) * 100);
      G('respCnt').textContent = T > 63.5 ? `${done} / 100 checked` : '';
      respLines.forEach((ln, j) => {
        const idx = Math.floor(scroll * 88) + j;
        ln.style.top = `${70 + j * 48}px`;
        ln.style.opacity = T > 63.5 && idx < done + 12 ? 1 : 0;
        ln.innerHTML = `<span style="color:var(--mint)">registered</span><span>${respSyms[idx % 100]}</span><span style="color:var(--quiet)">56:0x${(hash(idx) * 1e16).toString(16).slice(0, 4)}…</span>`;
      });
      const awT = [65.2, 65.9, 66.6];
      [0, 1, 2].forEach((i) => pop(G(`aw${i}`), T, awT[i], { from: 2.2, dur: 0.35 }));
    }
    // F: wallet and routes 68.3 – 74.4
    if (show('sF', T, 68.3, 74.4)) {
      applyCam('sF', T, 68.3, 74.4);
      const wp = easeOutExpo(span(T, 68.4, 69.1)); G('wal').style.opacity = span(T, 68.4, 68.55); G('wal').style.transform = `translateX(${(1 - wp) * -300}px)`;
      G('walAd').textContent = scramble('0x7b4e…c19a', span(T, 68.6, 69.2), frame, 11);
      holds.forEach((h, i) => { rise(h.el, T, 69.2 + i * 0.2, 0.5, 30); h.bal.textContent = (easeOutCubic(span(T, 69.3 + i * 0.2, 70.2 + i * 0.2)) * h.val).toFixed(2); });
      routes.forEach((r, i) => {
        const p = easeInOutCubic(span(T, 70.8 + i * 0.3, 71.6 + i * 0.3));
        r.path.style.strokeDashoffset = `${r.len * (1 - p)}`;
        const tp = (T - 71.6 - i * 0.3) * 0.9; const on = tp > 0;
        const pt = r.path.getPointAtLength(r.len * (on ? tp % 1 : 0));
        r.dot.setAttribute('cx', pt.x); r.dot.setAttribute('cy', pt.y); r.dot.style.opacity = on ? 1 : 0;
        const np = easeOutExpo(span(T, 71.3 + i * 0.3, 71.9 + i * 0.3)); G(`nd${i}`).style.opacity = span(T, 71.3 + i * 0.3, 71.4 + i * 0.3); G(`nd${i}`).style.transform = `translateX(${(1 - np) * 260}px)`;
      });
    }
    // G: outro 74.0 – 83
    const outroOn = T >= 74.0;
    if (outroOn) {
      drawOutro(T);
      G('logoLayer').style.display = 'block';
      const solid = easeOutBack(span(T, 75.2, 75.6));
      G('mark').style.opacity = span(T, 75.2, 75.35);
      G('mark').style.transform = `rotate(-8deg) scale(${lerp(0.82, 1, clamp(solid, 0, 1.2))})`;
      document.getElementById('ring').setAttribute('stroke-dashoffset', `${2 * Math.PI * 38 * (1 - 0.75 * easeInOutCubic(span(T, 75.3, 75.9)))}`);
      [...G('wordmark').children].forEach((c, i) => {
        const p = easeOutExpo(span(T, 75.3 + i * 0.05, 75.95 + i * 0.05));
        c.style.opacity = span(T, 75.3 + i * 0.05, 75.4 + i * 0.05);
        c.style.transform = `rotateX(${lerp(-95, 0, p)}deg) translateY(${(1 - p) * 40}px)`;
        c.style.backgroundPosition = `${lerp(100, -50, easeInOutCubic(span(T, 76.0, 76.9)))}% 0`;
      });
      G('tagline').style.opacity = 0;
      const lift = easeInOutCubic(span(T, 76.3, 76.9));
      G('logo').style.transform = `translate(-50%, calc(-50% - ${lift * 60}px))`;
    }
    if (show('sG', T, 76.3, 83.1)) {
      G('sG').style.opacity = 1; G('sG').style.transform = 'none';
      const ow = [76.5, 76.75, 76.95, 77.3, 77.6, 77.8, 78.0];
      outWords.forEach((w, i) => pop(w, T, ow[i], { from: 1.9, dur: 0.35, y: -20 }));
      const url = 'mintmark.nuvixes.studio';
      const n = Math.floor(span(T, 78.6, 79.7) * (url.length + 0.999));
      G('outUrl').textContent = url.slice(0, n) + (T > 78.5 && T < 81 && Math.floor(T * 2.4) % 2 ? '▍' : ' ');
      G('outFoot').style.opacity = span(T, 80.0, 80.6);
    }
    G('black').style.opacity = span(T, 82.0, 83.0).toFixed(3);
  };
})();
