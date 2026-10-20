/*
 * Water tank display.
 *
 * Loaded by the small page the NodeMCU serves at "/". The NodeMCU only measures:
 * GET /api pings the sensor and returns { "d": <cm from sensor to water> } (d is null when there is no echo).
 * This file polls every 3 s, stores each reading in localStorage, and draws the tank:
 * green while the water is more than 25 cm below the sensor, red once it is 25 cm or closer.
 *
 * Bump the ?v= number in the NodeMCU page after changing this file so phones fetch the new copy.
 */
(function () {
  'use strict';
  if (window.tankApp) return;
  window.tankApp = true;

  const CONFIG = {
    api: '/api',
    pollMs: 3000,
    tankCm: 70,   // probe face to tank floor
    redCm: 25,    // red when the water is this close to the probe or closer
    retainDays: 7
  };

  // ---------- Storage: one localStorage key per day, each an array of [time ms, d cm or null] ----------

  const PREFIX = 'tank.day.';
  const pad = n => String(n).padStart(2, '0');
  const dayKey = t => {
    const d = new Date(t);
    return PREFIX + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  function loadDay(key) {
    try {
      const list = JSON.parse(localStorage.getItem(key));
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function storedDays() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
    } catch (e) { /* storage unavailable */ }
    return keys.sort(); // YYYY-MM-DD sorts oldest first
  }

  function pruneOldDays() {
    const oldest = dayKey(Date.now() - CONFIG.retainDays * 86400000);
    storedDays().forEach(k => {
      if (k < oldest) {
        try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
      }
    });
  }

  let today = { key: dayKey(Date.now()), list: loadDay(dayKey(Date.now())) };

  function record(reading) {
    const key = dayKey(reading[0]);
    if (key !== today.key) {
      today = { key: key, list: loadDay(key) };
      pruneOldDays();
    }
    today.list.push(reading);
    const json = JSON.stringify(today.list);
    try {
      localStorage.setItem(key, json);
    } catch (e) {
      // Storage full: drop the oldest other day and try once more
      const old = storedDays().filter(k => k !== key)[0];
      try {
        if (old) localStorage.removeItem(old);
        localStorage.setItem(key, json);
      } catch (e2) { /* keep going without saving */ }
    }
  }

  // ---------- UI ----------

  const CSS = `
:root {
  --bg: #eef3f6; --panel: #ffffff; --fg: #0f1c24; --muted: #5b6b75; --line: #d3dde3; --tank: #e3ebf0;
  --water: #2f86c9; --water-top: #5aa6df; --red: #d33a2e; --red-tint: rgba(211,58,46,.10); --green: #23905a; --off: #8a979f;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a1217; --panel: #111c23; --fg: #e3ecf1; --muted: #8ea1ab; --line: #22323b; --tank: #15232b;
    --water: #3a95db; --water-top: #69b4ec; --red: #ff5b4d; --red-tint: rgba(255,91,77,.14); --green: #3cc07a; --off: #6c7c85;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; display: block; min-height: 0; text-align: left; background: var(--bg); color: var(--fg); font: 15px/1.45 var(--font);
  padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 32px max(16px, env(safe-area-inset-left, 0px)); }
main { max-width: 860px; margin: 0 auto; display: grid; gap: 14px; }
.num { font-variant-numeric: tabular-nums; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 22px; font-weight: 700; }
.chip { font: 500 12px var(--mono); color: var(--muted); display: inline-flex; align-items: center; gap: 6px; }
.chip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--chip, var(--off)); }
.status { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); }
.light { flex: none; width: 52px; height: 52px; border-radius: 50%; background: var(--state, var(--off)); box-shadow: 0 0 0 6px color-mix(in srgb, var(--state, var(--off)) 18%, transparent); }
.status h2 { margin: 0; font-size: 20px; line-height: 1.2; }
.status p { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
body[data-state="green"] { --state: var(--green); }
body[data-state="red"] { --state: var(--red); }
body[data-state="off"] { --state: var(--off); }
body[data-state="red"] .status { background: var(--red); border-color: var(--red); color: #fff; }
body[data-state="red"] .status p { color: rgba(255,255,255,.88); }
body[data-state="red"] .light { background: #fff; box-shadow: 0 0 0 6px rgba(255,255,255,.3); animation: tank-pulse 1s ease-in-out infinite; }
@keyframes tank-pulse { 50% { box-shadow: 0 0 0 14px rgba(255,255,255,0); } }
.cols { display: grid; gap: 14px; }
@media (min-width: 680px) { .cols { grid-template-columns: minmax(0,1fr) minmax(0,1fr); align-items: start; } }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; min-width: 0; }
.gauge svg { display: block; width: 100%; max-width: 360px; height: auto; margin: 0 auto; }
.t { fill: var(--muted); font: 11px var(--mono); }
.tl { font: 600 11.5px var(--font); }
.tank-bg { fill: var(--tank); }
.tank-wall { fill: none; stroke: var(--fg); stroke-width: 2.5; }
.tick { stroke: var(--muted); stroke-width: 1; }
.zone-red { fill: var(--red-tint); }
.line-red { stroke: var(--red); stroke-width: 2; }
.lbl-red { fill: var(--red); }
.probe { fill: var(--fg); }
#water { transition: transform .8s ease; }
.water { fill: var(--water); }
.wave { fill: var(--water-top); animation: tank-wave 3s linear infinite; }
@keyframes tank-wave { to { transform: translateX(-65px); } }
.level-tag { fill: var(--fg); font: 700 14px var(--font); }
.big { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.big strong { font-size: 44px; line-height: 1; font-weight: 700; }
.big span { color: var(--muted); }
dl { margin: 14px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
dl div { background: var(--panel); padding: 10px 12px; }
dt { font-size: 12px; color: var(--muted); }
dd { margin: 2px 0 0; font-size: 18px; font-weight: 600; }
.foot { color: var(--muted); font-size: 12.5px; margin: 12px 0 0; }
@media (prefers-reduced-motion: reduce) { .wave, body[data-state="red"] .light { animation: none; } #water { transition: none; } }
`;

  const PX = 350 / CONFIG.tankCm, TOP = 40, BOTTOM = 390;
  const yOf = levelCm => BOTTOM - levelCm * PX;
  const redLevel = CONFIG.tankCm - CONFIG.redCm; // water level (from the floor) where red starts

  function buildSvg() {
    const yRed = yOf(redLevel);
    let ticks = '';
    for (let cm = 0; cm <= CONFIG.tankCm; cm += 10) {
      ticks += `<line class="tick" x1="58" y1="${yOf(cm)}" x2="68" y2="${yOf(cm)}"/>` +
        `<text class="t num" x="52" y="${yOf(cm) + 4}" text-anchor="end">${cm}</text>`;
    }
    let wave = 'M5 46';
    for (let i = 0; i < 8; i++) wave += ' q16.25 -6 32.5 0';
    return `
<svg viewBox="0 0 300 420" role="img" aria-label="Tank gauge with the water level and the red line at ${redLevel} cm, ${CONFIG.redCm} cm below the sensor">
  <defs><clipPath id="inside"><rect x="70" y="${TOP}" width="130" height="350" rx="6"/></clipPath></defs>
  <rect class="tank-bg" x="70" y="${TOP}" width="130" height="350" rx="6"/>
  <g clip-path="url(#inside)">
    <rect class="zone-red" x="70" y="${TOP}" width="130" height="${yRed - TOP}"/>
    <g id="water">
      <path class="wave" d="${wave} V60 H5 Z"/>
      <rect class="water" x="70" y="46" width="130" height="350"/>
    </g>
    <line class="line-red" x1="70" y1="${yRed}" x2="200" y2="${yRed}"/>
  </g>
  <rect class="tank-wall" x="70" y="${TOP}" width="130" height="350" rx="6"/>
  <rect class="probe" x="125" y="24" width="20" height="16" rx="3"/>
  <text class="t" x="150" y="20" text-anchor="middle">sensor</text>
  ${ticks}
  <text class="t" x="52" y="${BOTTOM + 22}" text-anchor="end">cm</text>
  <text class="tl lbl-red" x="208" y="${yRed - 3}">red above</text>
  <text class="t lbl-red" x="208" y="${yRed + 11}">${redLevel} cm</text>
  <text class="level-tag num" id="levelTag" x="135" y="380" text-anchor="middle"></text>
</svg>`;
  }

  function buildPage() {
    if (window.fallbackTimer) clearInterval(window.fallbackTimer);
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.removeAttribute('style');
    document.body.innerHTML = `
<main>
  <header>
    <h1>Water tank</h1>
    <span class="chip" id="conn">connecting…</span>
  </header>
  <section class="status" aria-live="polite">
    <div class="light" aria-hidden="true"></div>
    <div><h2 id="statusTitle">Waiting for sensor</h2><p id="statusText">First reading in a few seconds.</p></div>
  </section>
  <div class="cols">
    <section class="card gauge">${buildSvg()}</section>
    <section class="card">
      <div class="big"><strong class="num" id="levelBig">--</strong><span>cm of ${CONFIG.tankCm}</span></div>
      <dl>
        <div><dt>Full</dt><dd class="num" id="pct">--</dd></div>
        <div><dt>Gap to sensor</dt><dd class="num" id="gap">--</dd></div>
      </dl>
      <p class="foot num" id="updated">No reading yet</p>
    </section>
  </div>
</main>`;
  }

  const $ = id => document.getElementById(id);
  let lastOk = 0, failures = 0;

  function setStatus(state, title, text) {
    document.body.dataset.state = state;
    $('statusTitle').textContent = title;
    $('statusText').textContent = text;
  }

  function render(d) {
    const offline = failures >= 2;
    $('conn').textContent = offline ? 'NodeMCU not responding' : 'live · ' + location.host;
    document.body.style.setProperty('--chip', offline ? 'var(--red)' : 'var(--green)');

    if (offline) {
      setStatus('off', 'NodeMCU not responding', 'Check that the board is powered and the phone is on the same Wi-Fi.');
      return;
    }
    if (d === undefined) return;
    if (d === null) {
      setStatus('off', 'No echo from the sensor', 'The sensor heard nothing back. Check the tank and the probe cable.');
      return;
    }

    const level = Math.min(CONFIG.tankCm, Math.max(0, CONFIG.tankCm - d));
    $('water').style.transform = `translateY(${(CONFIG.tankCm - level) * PX}px)`;
    $('levelTag').setAttribute('y', Math.min(BOTTOM - 8, Math.max(70, yOf(level) + 22)));
    $('levelTag').textContent = level.toFixed(1) + ' cm';
    $('levelBig').textContent = level.toFixed(1);
    $('pct').textContent = Math.round(level / CONFIG.tankCm * 100) + '%';
    $('gap').textContent = d.toFixed(1) + ' cm';

    if (d <= CONFIG.redCm) {
      setStatus('red', 'Stop the motor', 'Water is within ' + CONFIG.redCm + ' cm of the sensor.');
    } else {
      setStatus('green', 'OK', 'Water is more than ' + CONFIG.redCm + ' cm below the sensor.');
    }
  }

  setInterval(() => {
    if (!lastOk) return;
    const s = Math.round((Date.now() - lastOk) / 1000);
    $('updated').textContent = 'Updated ' + (s < 2 ? 'just now' : s + ' s ago');
  }, 1000);

  // One request every pollMs. The next one is scheduled after the previous finishes, so they never overlap.
  async function poll() {
    const started = Date.now();
    let d;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(CONFIG.api, { cache: 'no-store', signal: ctrl.signal });
      const j = await res.json();
      clearTimeout(timer);
      failures = 0;
      lastOk = Date.now();
      d = j.d == null ? null : Math.round(j.d * 10) / 10;
      record([lastOk, d]);
    } catch (e) {
      failures++;
    }
    render(d);
    setTimeout(poll, Math.max(0, CONFIG.pollMs - (Date.now() - started)));
  }

  function start() {
    pruneOldDays();
    buildPage();
    poll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
