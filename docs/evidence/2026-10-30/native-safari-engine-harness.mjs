import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patterns, consentPatternPage } from '../tests/fixtures/consent-patterns.mjs';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--port')) throw new Error('Usage: node artifacts/native-safari-engine-harness.mjs [--port 8766]');
const port = args.length ? Number(args[1]) : 8766;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const origin = `http://127.0.0.1:${port}`;
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/native-safari-engine-results.json');
const scope = 'Native Safari page-engine evidence only. Actual source scripts run in local synthetic pages; no installed extension, popup, storage, permission, Best Lawyers hostname or live-site proof. Other installed extensions are not claimed disabled; per-case no-engine baselines detect observable interference only.';
const cases = [...patterns.filter(id => !id.startsWith('best-')), 'positive-direct', 'positive-preferences', 'disabled-control'];
if (cases.length !== 16) throw new Error('Expected 13 non-Best-Lawyers patterns and three controls');
const resources = new Map();
const sources = {};
for (const [url, relative, type] of [
  ['/platforms.js', 'extension/content/platforms.js', 'text/javascript'],
  ['/engine.js', 'extension/content/engine.js', 'text/javascript'],
  ['/fonts/space-grotesk.ttf', 'extension/assets/fonts/space-grotesk.ttf', 'font/ttf'],
  ['/fonts/ibm-plex-mono.ttf', 'extension/assets/fonts/ibm-plex-mono.ttf', 'font/ttf'],
]) {
  const body = await readFile(path.join(root, relative));
  resources.set(url, { body, type });
  sources[relative] = createHash('sha256').update(body).digest('hex');
}
for (const relative of ['tests/fixtures/consent-patterns.mjs', 'artifacts/native-safari-engine-harness.mjs']) {
  sources[relative] = createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
}
const css = `@font-face{font-family:Space Grotesk;src:url('/fonts/space-grotesk.ttf')}@font-face{font-family:IBM Plex Mono;src:url('/fonts/ibm-plex-mono.ttf')}body{background:#050605;color:#f2efe6;font:16px/1.7 system-ui,sans-serif;margin:24px auto;padding:0 24px;max-width:1100px}h1{font-family:Space Grotesk,Arial,sans-serif;text-transform:uppercase;font-weight:500;text-align:left}button,iframe,pre{background:#0b0d0b;color:#f2efe6;border:1px solid rgba(242,239,230,.35);padding:12px}button{font:inherit;cursor:pointer}button:disabled{opacity:.6}iframe{box-sizing:border-box;width:100%;height:460px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 IBM Plex Mono,monospace}:focus-visible{outline:2px solid #5fb53c;outline-offset:3px}`;

function controlPage(id) {
  const preferences = id === 'positive-preferences';
  const controls = ['Necessary', 'Preferences', 'Statistics', 'Marketing'].map(name => `<label>${name}<input type="checkbox" checked ${name === 'Necessary' ? 'disabled' : ''} id="CybotCookiebotDialogBodyLevelButton${name}"></label>`).join('');
  const fixture = preferences
    ? `<section id="CybotCookiebotDialog"><h2>Cookie preferences</h2>${controls}<button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection">Allow selection</button><button id="accept">Accept all</button></section>`
    : '<section id="onetrust-banner-sdk"><h2>Cookie consent</h2><button id="onetrust-reject-all-handler">Reject all</button><button id="accept">Accept all</button></section>';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native Safari engine control</title><style>${css}</style><h1>DEMO / ${id}</h1><p>Local original control. No extension API or service is mocked.</p><div id="mount">${fixture}</div><script>
window.patternState={accept:0,reject:0,other:0,save:0,optionalClicks:0,optionalConsent:false};
document.getElementById('accept').onclick=()=>{patternState.accept++;patternState.optionalConsent=true};
if(${preferences}){
 for(const control of document.querySelectorAll('input:not(:disabled)'))control.onclick=()=>patternState.optionalClicks++;
 document.querySelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection').onclick=()=>{patternState.save++;window.finalOptionalStates=Array.from(document.querySelectorAll('input:not(:disabled)'),node=>node.checked);document.getElementById('CybotCookiebotDialog').remove()};
}else document.getElementById('onetrust-reject-all-handler').onclick=()=>{patternState.reject++;document.getElementById('onetrust-banner-sdk').remove()};
</script></html>`;
}

function pageFor(id) {
  const html = patterns.includes(id) ? consentPatternPage(id) : controlPage(id);
  const collector = `<script>window.harnessErrors=[];window.patternEvents=[];addEventListener('error',e=>harnessErrors.push(String(e.message)));addEventListener('unhandledrejection',e=>harnessErrors.push(String(e.reason?.message||e.reason)));</script>`;
  return html.replace(/(<html[^>]*>)/i, '$1' + collector).replace('</html>', '<script src="/platforms.js"></script><script src="/engine.js"></script></html>');
}

function browserRunner(config) {
  const start = document.getElementById('start');
  const progress = document.getElementById('progress');
  const evidence = document.getElementById('evidence');
  const holder = document.getElementById('fixture');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const failures = checks => Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  function snapshot(w) {
    if (!w.patternState || !Array.isArray(w.patternEvents)) throw new Error('Fixture state unavailable');
    const state = w.patternState;
    const mount = w.document.getElementById('mount');
    return {
      accept: state.accept || 0, reject: state.reject || 0, other: state.other || 0,
      save: state.save || 0, optionalClicks: state.optionalClicks || 0,
      optionalConsent: state.optionalConsent, completed: w.patternEvents.length,
      optionalStates: w.finalOptionalStates || Array.from(w.document.querySelectorAll('input[type="checkbox"]:not(:disabled)'), node => node.checked),
      surfacePresent: !!mount && Array.from(mount.children).some(node => {
        const style = w.getComputedStyle(node);
        return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && Array.from(node.getClientRects()).some(rect => rect.width > 0 && rect.height > 0);
      }),
    };
  }
  function baselineFailures(id, state) {
    return failures({ noAcceptance: state.accept === 0, noRejection: state.reject === 0,
      noOtherActions: state.other === 0, noSave: state.save === 0, noOptionalClicks: state.optionalClicks === 0,
      noCompletions: state.completed === 0, initialConsentIntact: state.optionalConsent === false,
      initialOptionalStateIntact: state.optionalStates.length === (id === 'positive-preferences' || id === 'drifted-save' ? 3 : 0) && state.optionalStates.every(value => value === true), visibleFixtureRetained: state.surfacePresent });
  }
  function activeFailures(id, state) {
    const direct = id === 'positive-direct';
    const preferences = id === 'positive-preferences';
    const opaque = id === 'opaque-replacement';
    return failures({ noAcceptance: state.accept === 0, noOtherActions: state.other === 0,
      noOptionalConsent: state.optionalConsent === false,
      expectedCompletion: state.completed === (direct || preferences ? 1 : 0),
      expectedRejection: opaque ? state.reject >= 1 && state.reject <= 3 : state.reject === (direct ? 1 : 0),
      expectedSave: state.save === (preferences ? 1 : 0), expectedOptionalClicks: state.optionalClicks === (preferences ? 3 : 0),
      optionalState: preferences ? state.optionalStates.length === 3 && state.optionalStates.every(value => value === false) : state.optionalStates.every(value => value === true),
      expectedSurface: direct || preferences ? !state.surfacePresent : state.surfacePresent });
  }
  start.onclick = async () => {
    start.disabled = true;
    const report = { version: 1, scope: config.scope, startedAt: new Date().toISOString(), finishedAt: '',
      userAgent: navigator.userAgent, sources: config.sources, complete: false, passed: false, results: [], errors: [] };
    for (const id of config.cases) {
      progress.textContent = `${report.results.length + 1}/${config.cases.length} / ${id} / no-engine baseline`;
      const result = { id, passed: false, baseline: null, active: null, errors: [] };
      const frame = document.createElement('iframe');
      frame.title = `Visible consent fixture: ${id}`;
      try {
        const loaded = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Fixture load timeout')), 15000);
          frame.onload = () => { clearTimeout(timer); resolve(); };
          frame.onerror = () => { clearTimeout(timer); reject(new Error('Fixture load failed')); };
        });
        frame.src = `/case/${id}`;
        holder.replaceChildren(frame);
        await loaded;
        const w = frame.contentWindow;
        if (!w.QuietExitEngine) throw new Error('Actual source engine unavailable');
        await w.document.fonts.ready;
        w.QuietExitEngine.stop();
        const before = performance.now();
        await sleep(config.waitMs);
        const initial = snapshot(w);
        result.baseline = { durationMs: performance.now() - before, state: initial, failures: baselineFailures(id, initial) };
        if (result.baseline.failures.length || w.harnessErrors.length) {
          result.errors.push('No-engine baseline failed; engine was not started.');
        } else {
          progress.textContent = `${report.results.length + 1}/${config.cases.length} / ${id} / actual page engine running`;
          const began = performance.now();
          w.QuietExitEngine.start({ onDenied: event => w.patternEvents.push(event), isEnabled: () => id !== 'disabled-control' });
          await sleep(config.waitMs);
          const state = snapshot(w);
          result.active = { durationMs: performance.now() - began, state, failures: activeFailures(id, state) };
        }
        result.errors.push(...w.harnessErrors);
        result.passed = !!result.active && !result.baseline.failures.length && !result.active.failures.length && !result.errors.length;
      } catch (error) { result.errors.push(String(error.message || error)); }
      finally {
        try { frame.contentWindow?.QuietExitEngine?.stop(); } catch (error) { result.errors.push(String(error)); result.passed = false; }
        frame.remove();
      }
      report.results.push(result);
      evidence.textContent = JSON.stringify(report, null, 2);
    }
    report.finishedAt = new Date().toISOString();
    report.complete = report.results.length === config.cases.length;
    report.passed = report.complete && report.results.every(result => result.passed);
    try {
      const response = await fetch('/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
      if (!response.ok) throw new Error(`Evidence save failed: HTTP ${response.status}`);
      progress.textContent = `${report.passed ? 'PASS' : 'FAIL'} / ${report.results.filter(result => result.passed).length}/${config.cases.length} / evidence saved locally`;
    } catch (error) { report.errors.push(String(error.message || error)); report.passed = false; progress.textContent = 'FAIL / evidence was not saved'; }
    evidence.textContent = JSON.stringify(report, null, 2);
    start.disabled = false;
  };
}

function dashboard() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiet Exit native Safari page-engine harness</title><style>${css}</style><h1>Native Safari / page-engine check</h1><p>${scope}</p><p>DEMO / 16 sequential cases. Each keeps its visible fixture for a three-second no-engine baseline, then observes the active engine for three seconds. A failed baseline fails the case and prevents its engine start. Allow about two minutes. Best Lawyers cases are excluded on loopback.</p><button id="start">Start local page-engine checks</button><p id="progress" role="status">Ready. Run this page in native Safari.</p><div id="fixture"></div><pre id="evidence">No run yet. Source hashes: ${JSON.stringify(sources, null, 2)}</pre><script>(${browserRunner.toString()})(${JSON.stringify({ cases, sources, scope, waitMs: 3000 })});</script></html>`;
}

const strings = value => Array.isArray(value) && value.length <= 50 && value.every(item => typeof item === 'string' && item.length <= 2000);
function validPhase(phase) {
  if (phase === null) return true;
  if (!phase || typeof phase.durationMs !== 'number' || phase.durationMs < 2800 || phase.durationMs > 3600000 || !strings(phase.failures)) return false;
  const state = phase.state;
  return state && ['accept', 'reject', 'other', 'save', 'optionalClicks', 'completed'].every(key => Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 1000) &&
    typeof state.optionalConsent === 'boolean' && typeof state.surfacePresent === 'boolean' && Array.isArray(state.optionalStates) && state.optionalStates.length <= 30 && state.optionalStates.every(value => typeof value === 'boolean');
}
function validReport(report) {
  const keys = ['version', 'scope', 'startedAt', 'finishedAt', 'userAgent', 'sources', 'complete', 'passed', 'results', 'errors'];
  return report && Object.keys(report).length === keys.length && Object.keys(report).every(key => keys.includes(key)) && report.version === 1 && report.scope === scope &&
    typeof report.userAgent === 'string' && report.userAgent.length > 0 && report.userAgent.length <= 1500 &&
    ['startedAt', 'finishedAt'].every(key => typeof report[key] === 'string' && Number.isFinite(Date.parse(report[key]))) &&
    report.sources && Object.keys(report.sources).length === Object.keys(sources).length && Object.entries(sources).every(([key, value]) => report.sources[key] === value) &&
    report.complete === true && typeof report.passed === 'boolean' && strings(report.errors) && Array.isArray(report.results) && report.results.length === cases.length &&
    report.results.every((result, index) => result && result.id === cases[index] && typeof result.passed === 'boolean' && strings(result.errors) && validPhase(result.baseline) && validPhase(result.active) &&
      (!result.passed || (result.baseline && result.active && !result.baseline.failures.length && !result.active.failures.length && !result.errors.length))) &&
    report.passed === (report.results.every(result => result.passed) && !report.errors.length);
}
const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const server = http.createServer(async (request, response) => {
  const send = (status, type, body) => { response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' }); response.end(body); };
  try {
    if (request.headers.host !== `127.0.0.1:${port}`) return send(403, 'text/plain', 'Loopback host required');
    const url = new URL(request.url, origin);
    if (url.origin !== origin || url.search) return send(404, 'text/plain', 'Unknown resource');
    if (request.method === 'GET') {
      if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', dashboard());
      const resource = resources.get(url.pathname);
      if (resource) return send(200, resource.type, resource.body);
      const id = url.pathname.startsWith('/case/') ? url.pathname.slice(6) : '';
      if (cases.includes(id)) return send(200, 'text/html; charset=utf-8', pageFor(id));
      return send(404, 'text/plain', 'Unknown resource');
    }
    if (request.method !== 'POST' || url.pathname !== '/results') return send(405, 'text/plain', 'Unsupported request');
    if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') return send(403, 'text/plain', 'Same-origin JSON required');
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 128 * 1024) return send(413, 'text/plain', 'Result body too large');
      chunks.push(chunk);
    }
    let report;
    try { report = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, 'text/plain', 'Invalid JSON'); }
    if (!validReport(report)) return send(400, 'text/plain', 'Invalid evidence schema');
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Saved ${output}: ${report.passed ? 'PASS' : 'FAIL'} (${report.results.filter(result => result.passed).length}/${cases.length})`);
    return send(200, 'application/json', JSON.stringify({ saved: true }));
  } catch (error) { console.error(error.message); if (!response.headersSent) send(500, 'text/plain', 'Harness error'); else response.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`${origin}/ — ${cases.length} cases; native Safari page-engine evidence only. Results: ${output}`));
