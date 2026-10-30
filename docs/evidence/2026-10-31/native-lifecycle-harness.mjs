// Local installed-extension lifecycle observation only. No product code is injected.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

const selfCheck = process.argv.slice(2).join(' ') === '--self-check';
if (process.argv.length > 2 && !selfCheck) throw new Error('Usage: node artifacts/ios-2026-10-31/native-lifecycle-harness.mjs [--self-check]');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = fileURLToPath(new URL('./', import.meta.url));
const directMarkup = '<section id="onetrust-banner-sdk" role="dialog" aria-label="Cookie consent"><h2>We use cookies</h2><button id="onetrust-accept-btn-handler">Accept all</button><button id="onetrust-reject-all-handler">Reject all</button></section>';
const manual = await readFile(path.join(root, 'scripts/manual-fixtures.mjs'), 'utf8');
assert(manual.includes(`mount.innerHTML='${directMarkup}'`), 'Direct fixture must match the original manual source exactly');
const sources = {};
for (const relative of ['scripts/manual-fixtures.mjs', 'artifacts/ios-2026-10-31/native-lifecycle-harness.mjs']) sources[relative] = createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
const scope = 'Top-level local synthetic lifecycle observations supplied by the installed extension. Extension switch, permission, popup count and package identity require separate native evidence. No automatic paused/enabled verdict, engine injection, extension API, consent SDK, cookie or storage access.';
const runs = new Map();
let origin;
const validLabel = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const validId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const date = value => typeof value === 'string' && value.length < 40 && Number.isFinite(Date.parse(value));

function browser(config) {
  const mount = document.getElementById('mount');
  const counter = document.getElementById('counter');
  const evidence = document.getElementById('evidence');
  const status = document.getElementById('status');
  const log = document.getElementById('log');
  const documentId = crypto.randomUUID();
  const state = { accept: 0, reject: 0, inserted: 0, queueAt: null, dueAt: null, insertedAt: null, pageshowPersisted: null, pageshowCount: 0 };
  const events = [];
  let sequence = 0, timer;
  function snapshot() {
    return { ...state, surfacePresent: !!document.getElementById('onetrust-banner-sdk'), visibility: document.visibilityState, navigationType: performance.getEntriesByType('navigation')[0]?.type || 'unknown' };
  }
  function display() {
    counter.textContent = `Accept ${state.accept} / Reject ${state.reject} / Inserted ${state.inserted}`;
    evidence.textContent = JSON.stringify({ device: config.device, run: config.run, documentId, ...snapshot() }, null, 2);
    log.textContent = events.map(event => `${event.sequence} / ${event.at} / ${event.kind}${event.persisted === null ? '' : ` / persisted=${event.persisted}`}`).join('\n');
  }
  function record(kind, persisted = null) {
    const event = { version: 1, device: config.device, run: config.run, documentId, eventId: crypto.randomUUID(), sequence: ++sequence, at: new Date().toISOString(), kind, persisted, userAgent: navigator.userAgent, state: snapshot(), sources: config.sources };
    events.push(event); display();
    fetch('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), keepalive: true })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const saved = await response.json();
        status.textContent = `Saved event ${event.sequence}: ${saved.file}`;
      }).catch(error => { status.textContent = `SAVE FAILED for event ${event.sequence}: ${error.message}`; });
  }
  function insert() {
    mount.innerHTML = config.directMarkup;
    const banner = mount.firstElementChild;
    banner.querySelector('#onetrust-accept-btn-handler').onclick = () => { state.accept++; record('accept'); };
    banner.querySelector('#onetrust-reject-all-handler').onclick = () => { state.reject++; banner.remove(); record('reject'); };
    state.inserted++; state.insertedAt = new Date().toISOString(); record('insert');
  }
  document.getElementById('insert').onclick = () => { clearTimeout(timer); if (state.dueAt) record('queue-replaced-by-direct'); state.queueAt = null; state.dueAt = null; insert(); };
  document.getElementById('queue').onclick = () => {
    clearTimeout(timer);
    state.queueAt = new Date().toISOString(); state.dueAt = new Date(Date.now() + 30000).toISOString(); record('queue');
    timer = setTimeout(() => { record('queue-fired'); insert(); state.queueAt = null; state.dueAt = null; record('queue-finished'); }, 30000);
  };
  document.getElementById('away').onclick = () => record('away-click');
  window.addEventListener('pageshow', event => { state.pageshowPersisted = event.persisted; state.pageshowCount++; record('pageshow', event.persisted); });
  record('document-ready');
}

const css = `@font-face{font-family:'Space Grotesk';src:url('/fonts/space-grotesk.ttf')}@font-face{font-family:'IBM Plex Mono';src:url('/fonts/ibm-plex-mono.ttf')}
:root{--ee-canvas:#050605;--ee-panel:#0b0d0b;--ee-text:#f2efe6;--ee-muted:#8b8f86;--ee-accent:#5fb53c;--ee-hairline-strong:rgba(242,239,230,.13);--ee-hairline-rest:rgba(242,239,230,.35)}*{box-sizing:border-box}body{margin:0;padding:14px;background:var(--ee-canvas);color:var(--ee-text);font:15px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto}h1,h2{font-family:'Space Grotesk',Arial,sans-serif;text-transform:uppercase;text-align:left;line-height:1.15;margin:8px 0}h1{font-size:25px}h2{font-size:19px}p{margin:8px 0}.meta,footer{font:11px/1.6 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ee-muted)}button,a.control{display:inline-block;font:inherit;color:var(--ee-text);background:var(--ee-panel);border:1px solid var(--ee-hairline-rest);padding:9px;margin:3px 3px 3px 0;border-radius:0;text-decoration:none}a{color:var(--ee-accent)}section,pre{padding:10px;background:var(--ee-panel);border:1px solid var(--ee-hairline-strong)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 'IBM Plex Mono',monospace}#status{font-size:12px;overflow-wrap:anywhere}#counter{font-weight:600}footer{border-top:1px solid var(--ee-hairline-strong);padding-top:12px}:focus-visible{outline:2px solid var(--ee-accent);outline-offset:3px}`;
const escapeHTML = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function page(device, run, away = false) {
  const query = new URLSearchParams({ device, run });
  const body = away
    ? `<h1>History away page</h1><p>Use Safari Back to return. A restored lifecycle document records the real pageshow.persisted value. A reload records a new document ID.</p><p class="meta">Device ${escapeHTML(device)} / Run ${escapeHTML(run)}</p>`
    : `<h1>Safari lifecycle</h1><p id="counter" aria-live="polite">Accept 0 / Reject 0 / Inserted 0</p><div><button id="insert">Insert direct</button><button id="queue">Queue direct in 30 seconds</button></div><p><a class="control" id="away" href="/away?${query}">Away, then Safari Back</a> <a href="/?device=${encodeURIComponent(device)}">Fresh run</a></p><div id="mount"></div><p id="status" role="status">Waiting to save first event.</p><p class="meta">Device ${escapeHTML(device)} / Run ${escapeHTML(run)}</p><details><summary>Page evidence and event log</summary><pre id="evidence"></pre><pre id="log"></pre></details><p>Use the real popup to change the switch before the queue is due. This page records actions and timestamps; read the popup count separately.</p><p><a href="/events?${query}">Read saved events</a></p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiet Exit lifecycle ${away ? 'away' : 'fixture'}</title><style>${css}</style></head><body><main><p class="meta">Demo / Eric Escapes / Installed-extension observation</p>${body}<footer>Local synthetic lifecycle / No automatic extension-state verdict</footer></main>${away ? '' : `<script>(${browser.toString()})(${JSON.stringify({ device, run, sources, directMarkup })});</script>`}</body></html>`;
}
function validEvent(event) {
  const state = event?.state;
  return event && event.version === 1 && validLabel(event.device) && validLabel(event.run) && validId(event.documentId) && validId(event.eventId) && Number.isInteger(event.sequence) && event.sequence > 0 && event.sequence <= 500 && date(event.at) &&
    ['document-ready', 'pageshow', 'away-click', 'queue', 'queue-fired', 'queue-finished', 'queue-replaced-by-direct', 'insert', 'accept', 'reject'].includes(event.kind) &&
    (event.kind === 'pageshow' ? typeof event.persisted === 'boolean' : event.persisted === null) && typeof event.userAgent === 'string' && event.userAgent.length > 0 && event.userAgent.length < 1500 && JSON.stringify(event.sources) === JSON.stringify(sources) &&
    state && ['accept', 'reject', 'inserted', 'pageshowCount'].every(key => Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 500) && ['queueAt', 'dueAt', 'insertedAt'].every(key => state[key] === null || date(state[key])) &&
    (state.pageshowPersisted === null || typeof state.pageshowPersisted === 'boolean') && typeof state.surfacePresent === 'boolean' && ['visible', 'hidden'].includes(state.visibility) && ['navigate', 'reload', 'back_forward', 'prerender', 'unknown'].includes(state.navigationType) &&
    (event.kind !== 'pageshow' || state.pageshowPersisted === event.persisted);
}
const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const server = http.createServer(async (request, response) => {
  const send = (status, type, body, document = false) => {
    // Do not add no-store to navigation documents; preserve Safari's real bfcache eligibility.
    response.writeHead(status, { 'Content-Type': type, ...(document ? {} : { 'Cache-Control': 'no-store' }), 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' }); response.end(body);
  };
  try {
    if (request.headers.host !== new URL(origin).host) return send(403, 'text/plain', 'Loopback host required');
    const url = new URL(request.url, origin);
    if (url.origin !== origin) return send(403, 'text/plain', 'Same origin required');
    if (request.method === 'GET') {
      if (url.pathname === '/' || url.pathname === '/away') {
        const device = url.searchParams.get('device') || 'iphone18pro';
        const run = url.searchParams.get('run');
        if (!validLabel(device) || (run !== null && !validLabel(run))) return send(400, 'text/plain', 'Invalid device/run label');
        if (!run) { response.writeHead(302, { Location: `/?${new URLSearchParams({ device, run: randomUUID() })}` }); return response.end(); }
        return send(200, 'text/html; charset=utf-8', page(device, run, url.pathname === '/away'), true);
      }
      if (url.pathname === '/events') {
        const device = url.searchParams.get('device'), run = url.searchParams.get('run');
        if (!validLabel(device) || !validLabel(run)) return send(400, 'text/plain', 'Supply valid device and run');
        return send(200, 'application/json', JSON.stringify({ scope, device, run, events: runs.get(`${device}/${run}`) || [] }, null, 2));
      }
      if (['/fonts/space-grotesk.ttf', '/fonts/ibm-plex-mono.ttf'].includes(url.pathname)) return send(200, 'font/ttf', await readFile(path.join(root, 'extension/assets', url.pathname.slice(1))));
      return send(404, 'text/plain', 'Unknown resource');
    }
    if (request.method !== 'POST' || url.pathname !== '/events' || url.search) return send(405, 'text/plain', 'Unsupported request');
    if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') return send(403, 'text/plain', 'Same-origin JSON required');
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 16384) return send(413, 'text/plain', 'Event too large'); chunks.push(chunk); }
    let event;
    try { event = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, 'text/plain', 'Invalid JSON'); }
    if (!validEvent(event)) return send(400, 'text/plain', 'Invalid event');
    const key = `${event.device}/${event.run}`;
    if ((!runs.has(key) && runs.size >= 100) || (runs.get(key)?.length || 0) >= 500) return send(429, 'text/plain', 'Session event limit reached');
    const file = `lifecycle-${event.device}-${event.run}-${event.documentId}-${event.sequence}-${event.eventId}.json`;
    const saved = { ...event, receivedAt: new Date().toISOString(), file, scope };
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, file), JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(saved);
    console.log(`Saved ${path.join(output, file)} / ${event.kind}${event.kind === 'pageshow' ? ` persisted=${event.persisted}` : ''}`);
    return send(200, 'application/json', JSON.stringify({ saved: true, file }));
  } catch (error) { console.error(error.message); if (!response.headersSent) send(500, 'text/plain', 'Lifecycle instrument error'); else response.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(selfCheck ? 0 : 8768, '127.0.0.1', resolve); });
origin = `http://127.0.0.1:${server.address().port}`;
if (selfCheck) {
  try {
    const redirect = await fetch(origin, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    const response = await fetch(new URL(redirect.headers.get('location'), origin));
    const html = await response.text();
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), null);
    new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
    assert(html.includes('Queue direct in 30 seconds'));
    assert(!html.includes('unload') && !html.includes('pagehide') && !html.includes('<script src=') && !html.includes('history.back'));
    assert.equal((await fetch(`${origin}/away?device=test&run=check`)).headers.get('cache-control'), null);
    assert.equal((await fetch(`${origin}/engine.js`)).status, 404);
    assert.deepEqual((await (await fetch(`${origin}/events?device=test&run=check`)).json()).events, []);
    assert.equal((await fetch(`${origin}/events`, { method: 'POST', headers: { Origin: 'http://external.invalid', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${origin}/events`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal(validEvent({ kind: 'pageshow', persisted: true }), false);
    console.log('Lifecycle instrument self-check PASS: exact direct fixture, browser-script syntax, fresh-run redirect, navigation documents without no-store, no unload/history automation or served engine, empty event read, invalid/cross-origin writes rejected. No browser/native test and no evidence files written.');
  } finally { await new Promise(resolve => server.close(resolve)); }
} else console.log(`${origin}/?device=iphone18pro — top-level lifecycle instrument. Fresh run query generated on entry; queue due in 30 seconds. Ctrl-C stops this server; saved lifecycle JSON remains in ${output}. GET /events?device=<label>&run=<run> reads this process's saved event index.`);
