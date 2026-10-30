// Scratch native-installed-extension instrument. Never imports or serves engine scripts.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { patterns, consentPatternPage } from '../../tests/fixtures/consent-patterns.mjs';

const selfCheck = process.argv.slice(2).join(' ') === '--self-check';
if (process.argv.length > 2 && !selfCheck) throw new Error('Usage: node artifacts/ios-2026-10-31/native-installed-harness.mjs [--self-check]');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = fileURLToPath(new URL('./', import.meta.url));
const negatives = ['unknown', 'indeterminate', 'disabled', 'hidden', 'missing', 'vendors', 'interest', 'collapsed'];
const cases = [
  ...patterns.filter(id => !id.startsWith('best-')).map(id => ({ id, type: 'pattern', waitMs: id === 'opaque-replacement' ? 12000 : 3000, enabledCountDelta: 0 })),
  ...['direct', 'preferences', 'late', ...negatives, 'failed', 'replacement'].map(id => ({ id, type: 'manual', waitMs: id === 'late' ? 8000 : ['failed', 'replacement'].includes(id) ? 12000 : 3000, enabledCountDelta: ['direct', 'preferences', 'late'].includes(id) ? 1 : 0 })),
];
assert.equal(cases.length, 26);
assert.equal(cases.filter(item => item.type === 'pattern').length, 13);
const sources = {};
for (const relative of ['scripts/manual-fixtures.mjs', 'tests/fixtures/consent-patterns.mjs', 'scripts/build.mjs', 'extension/content/engine.js', 'extension/content/platforms.js', 'extension/content/content.js', 'extension/background.js', 'artifacts/ios-2026-10-31/native-installed-harness.mjs']) {
  sources[relative] = createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
}
const scope = 'Installed-extension observation in visible local synthetic frames. No engine injection, extension API mocks, consent SDK calls, cookie writes or extension storage access. Popup counts, installed-package identity and extension permissions require separate native observations. Best Lawyers and live sites are excluded.';
const baselines = new Map();
let origin;

// Shared by browser and server: the server recomputes verdicts from the submitted observations.
function evaluate(item, mode, state) {
  const failures = [];
  const require = (condition, label) => { if (!condition) failures.push(label); };
  const enabled = mode === 'enabled';
  const positiveDirect = enabled && ['direct', 'late'].includes(item.id);
  const positivePreferences = enabled && item.id === 'preferences';
  const unresolvedReject = enabled && ['opaque-replacement', 'failed', 'replacement'].includes(item.id);
  require(state.readyState === 'complete' && state.evidencePresent && state.mountPresent, 'complete nonblank fixture evidence');
  require(state.documentVisible && state.frameVisible, 'fixture and tab visible throughout observation');
  require(state.accept === 0 && state.other === 0 && state.unrelated === 0, 'no accept, other or unrelated clicks');
  require(state.optionalConsent === false, 'optional consent remains false');
  require(unresolvedReject ? state.reject >= 1 && state.reject <= 3 : state.reject === (positiveDirect ? 1 : 0), 'expected rejection clicks');
  require(state.save === (positivePreferences ? 1 : 0), 'expected save clicks');
  require(state.optionalClicks === (positivePreferences ? 3 : 0), 'expected optional-control clicks');
  require(state.surfacePresent === !(positiveDirect || positivePreferences), 'expected retained or removed interface');
  if (positivePreferences) {
    const expected = Object.fromEntries(['Necessary', 'Preferences', 'Statistics', 'Marketing'].map(name => [`CybotCookiebotDialogBodyLevelButton${name}`, name === 'Necessary']));
    require(state.inputs.length === 0 && state.savedStates.length === 1 && JSON.stringify(state.savedStates[0]) === JSON.stringify(expected), 'saved necessary true and three optional categories false');
  } else {
    require(state.savedStates.length === 0, 'no saved preferences');
    const names = item.type === 'manual' && !['direct', 'late', 'failed', 'replacement'].includes(item.id) || item.id === 'drifted-save'
      ? ['Necessary', 'Preferences', 'Statistics', 'Marketing'].filter(name => !(item.id === 'missing' && name === 'Marketing')) : [];
    if (item.id === 'unknown') names.push('unknown');
    require(state.inputs.length === names.length, 'complete initial input inventory');
    require(state.inputs.every((input, index) => input.id === (names[index] === 'unknown' ? 'unknown' : `CybotCookiebotDialogBodyLevelButton${names[index]}`) && input.checked === true && input.indeterminate === (item.id === 'indeterminate' && names[index] === 'Marketing') && input.disabled === (names[index] === 'Necessary' || (item.id === 'disabled' && names[index] === 'Marketing')) && input.hidden === (item.id === 'hidden' && names[index] === 'Marketing')), 'initial inputs unchanged');
    // The replacement's only input lives in its open shadow root; observe it explicitly.
    require(state.shadowOptionalStates.length === (enabled && item.id === 'opaque-replacement' ? 1 : 0) && state.shadowOptionalStates.every(value => value === true), 'opaque replacement optional state unchanged');
  }
  require(state.errors.length === 0, 'no observed fixture errors');
  return failures;
}

function runBrowser(config, evaluate) {
  const buttons = [...document.querySelectorAll('button[data-mode]')];
  const progress = document.getElementById('progress');
  const evidence = document.getElementById('evidence');
  const holder = document.getElementById('fixture');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const label = document.getElementById('device');
  const show = report => { evidence.textContent = JSON.stringify(report, null, 2); };
  function snapshot(frame, item, errors, visible) {
    const w = frame.contentWindow;
    const d = w.document;
    const node = d.getElementById('pattern-evidence') || d.getElementById('evidence');
    const raw = JSON.parse(node?.textContent || 'null');
    const counterKeys = item.type === 'pattern' ? ['accept', 'reject', 'other'] : ['accept', 'reject', 'save', 'optionalClicks', 'unrelated'];
    if (!raw || !counterKeys.every(key => Number.isInteger(raw[key])) || (item.type === 'pattern' ? typeof raw.optionalConsent !== 'boolean' : !Array.isArray(raw.savedStates))) throw new Error('Missing fixture counters or state');
    const mount = d.getElementById('mount');
    const rendered = node => {
      const style = w.getComputedStyle(node);
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && [...node.getClientRects()].some(rect => rect.width > 0 && rect.height > 0);
    };
    const shadowOptionalStates = [];
    for (const node of mount?.querySelectorAll('*') || []) if (node.shadowRoot) for (const input of node.shadowRoot.querySelectorAll('input[type="checkbox"]')) shadowOptionalStates.push(input.checked);
    return {
      readyState: d.readyState, evidencePresent: !!node, mountPresent: !!mount,
      documentVisible: visible && document.visibilityState === 'visible' && d.visibilityState === 'visible',
      frameVisible: rendered(frame), url: w.location.href,
      accept: raw.accept, reject: raw.reject, other: raw.other ?? 0, save: raw.save ?? 0,
      optionalClicks: raw.optionalClicks ?? 0, unrelated: raw.unrelated ?? 0,
      optionalConsent: raw.optionalConsent ?? false,
      savedStates: raw.savedStates ?? [],
      inputs: [...d.querySelectorAll('input[type="checkbox"]')].map(input => ({ id: input.id || 'unknown', checked: input.checked, indeterminate: input.indeterminate, disabled: input.disabled, hidden: !!input.closest('[hidden]') })),
      shadowOptionalStates, surfacePresent: !!mount && [...mount.children].some(rendered), errors: [...errors],
    };
  }
  async function run(mode) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(label.value)) { progress.textContent = 'Enter a device label using letters, digits, hyphens or underscores.'; return; }
    buttons.forEach(button => { button.disabled = true; }); label.disabled = true;
    let baselineRunId = null;
    const report = { version: 1, scope: config.scope, device: label.value, mode, runId: crypto.randomUUID(), baselineRunId,
      startedAt: new Date().toISOString(), finishedAt: '', userAgent: navigator.userAgent, sources: config.sources,
      complete: false, passed: false, expectedPopupDelta: mode === 'enabled' ? 3 : 0, results: [], errors: [] };
    try {
      if (mode === 'enabled') {
        const response = await fetch(`/baseline?device=${encodeURIComponent(report.device)}`);
        if (!response.ok) throw new Error('Run and save a passing OFF baseline for this device first.');
        report.baselineRunId = (await response.json()).runId;
      }
      for (const item of config.cases) {
        progress.textContent = `${mode.toUpperCase()} / ${report.results.length + 1}/${config.cases.length} / ${item.id} / ${item.waitMs / 1000} seconds`;
        const result = { id: item.id, type: item.type, expectedPopupDelta: mode === 'enabled' ? item.enabledCountDelta : 0, durationMs: 0, state: null, failures: [], errors: [], passed: false };
        const frame = document.createElement('iframe'); frame.title = `Visible fixture: ${item.id}`;
        const frameErrors = [];
        let visible = document.visibilityState === 'visible';
        const onVisibility = () => { if (document.visibilityState !== 'visible') visible = false; };
        document.addEventListener('visibilitychange', onVisibility);
        try {
          const loaded = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Fixture load timeout')), 15000);
            frame.onload = () => { clearTimeout(timer); resolve(); };
            frame.onerror = () => { clearTimeout(timer); reject(new Error('Fixture load error')); };
          });
          frame.src = item.type === 'pattern' ? `/patterns?case=${encodeURIComponent(item.id)}` : '/manual';
          holder.replaceChildren(frame);
          frame.scrollIntoView({ block: 'start' });
          await loaded;
          const w = frame.contentWindow;
          w.addEventListener('error', event => frameErrors.push(String(event.message)));
          w.addEventListener('unhandledrejection', event => frameErrors.push(String(event.reason)));
          if (item.type === 'manual') {
            const select = w.document.getElementById('scenario');
            if (!select || !w.document.getElementById('show') || !w.document.getElementById('evidence')) throw new Error('Original manual fixture controls missing');
            select.value = item.id;
            if (select.value !== item.id) throw new Error('Manual scenario unavailable');
            w.document.getElementById('show').click();
            w.document.getElementById('mount').scrollIntoView({ block: 'start' });
          }
          const started = performance.now();
          if (item.id === 'late') setTimeout(() => { if (frame.isConnected) w.document.getElementById('mount')?.scrollIntoView({ block: 'start' }); }, 5100);
          await sleep(item.waitMs);
          result.durationMs = performance.now() - started;
          result.state = snapshot(frame, item, frameErrors, visible);
          result.failures = evaluate(item, mode, result.state);
          result.passed = result.failures.length === 0;
        } catch (error) { result.errors.push(String(error.message || error)); }
        finally { document.removeEventListener('visibilitychange', onVisibility); frame.remove(); }
        report.results.push(result); show(report);
      }
      report.complete = report.results.length === config.cases.length;
      report.passed = report.complete && report.results.every(result => result.passed);
    } catch (error) { report.errors.push(String(error.message || error)); }
    report.finishedAt = new Date().toISOString();
    report.passed = report.passed && report.errors.length === 0;
    try {
      const response = await fetch('/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
      if (!response.ok) throw new Error(`Evidence save failed: HTTP ${response.status} ${await response.text()}`);
      const saved = await response.json();
      progress.textContent = `${report.passed ? 'PASS' : 'FAIL'} / ${report.results.filter(result => result.passed).length}/${config.cases.length} / ${saved.file} / expected popup delta ${report.expectedPopupDelta}`;
      report.savedArtifact = saved.file;
    } catch (error) { report.passed = false; report.errors.push(String(error.message || error)); progress.textContent = 'FAIL / evidence not saved'; }
    show(report); progress.scrollIntoView({ block: 'center' });
    buttons.forEach(button => { button.disabled = false; }); label.disabled = false;
  }
  buttons.forEach(button => { button.onclick = () => run(button.dataset.mode); });
  label.value = new URL(location.href).searchParams.get('device') || 'iphone18pro';
}

function dashboard() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiet Exit installed Safari checks</title><style>
@font-face{font-family:'Space Grotesk';src:url('/fonts/space-grotesk.ttf')}@font-face{font-family:'IBM Plex Mono';src:url('/fonts/ibm-plex-mono.ttf')}
:root{--ee-canvas:#050605;--ee-panel:#0b0d0b;--ee-text:#f2efe6;--ee-muted:#8b8f86;--ee-accent:#5fb53c;--ee-hairline-strong:rgba(242,239,230,.13);--ee-hairline-rest:rgba(242,239,230,.35)}
*{box-sizing:border-box}body{background:var(--ee-canvas);color:var(--ee-text);font:16px/1.7 system-ui,sans-serif;margin:0;padding:20px}main{max-width:950px;margin:auto}h1{font-family:'Space Grotesk',Arial,sans-serif;font-size:clamp(24px,6vw,38px);text-transform:uppercase;line-height:1.15;text-align:left}.meta,footer{font:12px/1.7 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ee-muted)}button,input{font:inherit;color:var(--ee-text);background:var(--ee-panel);border:1px solid var(--ee-hairline-rest);padding:12px;max-width:100%;margin:4px 4px 4px 0;border-radius:0}button:disabled{opacity:.6}label{display:block}iframe{display:block;width:100%;height:620px;border:1px solid var(--ee-hairline-rest);background:var(--ee-panel)}pre{padding:16px;border:1px solid var(--ee-hairline-strong);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 'IBM Plex Mono',monospace}footer{border-top:1px solid var(--ee-hairline-strong);padding-top:16px}:focus-visible{outline:2px solid var(--ee-accent);outline-offset:3px}
</style></head><body><main><p class="meta">Demo / Eric Escapes / Native test instrument</p><h1>Installed Safari checks</h1>
<p>Start the original manual fixture server on port 8765. In the installed Quiet Exit popup, turn Automatically decline off and record the count. Run the OFF baseline. Then turn it on, record the count and run enabled checks. Leave this tab visible while each suite runs, about two minutes.</p>
<p>26 sequential visible fixtures: 13 consent patterns, three positives including a five-second late banner, eight incomplete preferences and two unresolved rejections. Pattern inputs are rendered before frame load; manual inputs are inserted using the original fixture controls after load. Expected popup count delta: OFF 0; enabled +3. Read the popup separately after each suite.</p>
<label for="device">Device evidence label</label><input id="device" maxlength="64" autocomplete="off" spellcheck="false"><div><button data-mode="off">Run baseline: extension OFF</button><button data-mode="enabled">Run enabled checks</button></div>
<p id="progress" role="status">Ready. These buttons do not change extension settings.</p><div id="fixture"></div><pre id="evidence">No evidence recorded yet.</pre><footer>Local synthetic interfaces / Simulator evidence is separate from physical-device evidence</footer>
</main><script>(${runBrowser.toString()})(${JSON.stringify({ cases, scope, sources })}, ${evaluate.toString()});</script></body></html>`;
}

function validState(state) {
  return state && ['accept', 'reject', 'other', 'save', 'optionalClicks', 'unrelated'].every(key => Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 1000) &&
    ['evidencePresent', 'mountPresent', 'documentVisible', 'frameVisible', 'optionalConsent', 'surfacePresent'].every(key => typeof state[key] === 'boolean') &&
    ['complete', 'interactive', 'loading'].includes(state.readyState) && typeof state.url === 'string' && state.url.length < 1000 &&
    Array.isArray(state.inputs) && state.inputs.length <= 20 && state.inputs.every(input => typeof input.id === 'string' && input.id.length < 200 && ['checked', 'indeterminate', 'disabled', 'hidden'].every(key => typeof input[key] === 'boolean')) &&
    Array.isArray(state.shadowOptionalStates) && state.shadowOptionalStates.length <= 20 && state.shadowOptionalStates.every(value => typeof value === 'boolean') &&
    Array.isArray(state.savedStates) && state.savedStates.length <= 5 && state.savedStates.every(value => value && Object.keys(value).length <= 20 && Object.entries(value).every(([key, value]) => key.length < 200 && typeof value === 'boolean')) && strings(state.errors);
}
function strings(value) { return Array.isArray(value) && value.length <= 50 && value.every(item => typeof item === 'string' && item.length <= 2000); }
function validReport(report) {
  if (!report || report.version !== 1 || report.scope !== scope || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(report.device) || !['off', 'enabled'].includes(report.mode) || !/^[a-f0-9-]{36}$/.test(report.runId) ||
      typeof report.userAgent !== 'string' || !report.userAgent.length || report.userAgent.length > 1500 || !['startedAt', 'finishedAt'].every(key => typeof report[key] === 'string' && Number.isFinite(Date.parse(report[key]))) ||
      JSON.stringify(report.sources) !== JSON.stringify(sources) || typeof report.complete !== 'boolean' || typeof report.passed !== 'boolean' || !strings(report.errors) ||
      report.expectedPopupDelta !== (report.mode === 'enabled' ? 3 : 0) || !Array.isArray(report.results) || report.results.length > cases.length) return false;
  if (report.mode === 'off' && report.baselineRunId !== null) return false;
  if (report.mode === 'enabled' && report.baselineRunId !== baselines.get(report.device)?.runId && !(report.baselineRunId === null && !report.complete && !report.passed && report.errors.length && report.results.length === 0)) return false;
  for (let index = 0; index < report.results.length; index++) {
    const result = report.results[index], item = cases[index];
    if (!result || result.id !== item.id || result.type !== item.type || result.expectedPopupDelta !== (report.mode === 'enabled' ? item.enabledCountDelta : 0) || typeof result.passed !== 'boolean' || !strings(result.errors) || !strings(result.failures) || !Number.isFinite(result.durationMs) || result.durationMs < 0 || result.durationMs > 3600000) return false;
    if (result.state !== null && !validState(result.state)) return false;
    if (result.state) {
      const expectedURL = item.type === 'pattern' ? `${origin}/patterns?case=${encodeURIComponent(item.id)}` : `${origin}/manual`;
      if (result.state.url !== expectedURL || JSON.stringify(result.failures) !== JSON.stringify(evaluate(item, report.mode, result.state))) return false;
    }
    const passed = !!result.state && result.durationMs >= item.waitMs * .95 && !result.errors.length && !result.failures.length;
    if (result.passed !== passed) return false;
  }
  return report.complete === (report.results.length === cases.length) && report.passed === (report.complete && !report.errors.length && report.results.every(result => result.passed));
}

const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const server = http.createServer(async (request, response) => {
  const send = (status, type, body) => { response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' }); response.end(body); };
  try {
    if (request.headers.host !== new URL(origin).host) return send(403, 'text/plain', 'Loopback host required');
    const url = new URL(request.url, origin);
    if (url.origin !== origin) return send(403, 'text/plain', 'Same origin required');
    if (request.method === 'GET') {
      if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', dashboard());
      if (url.pathname === '/baseline') {
        const baseline = baselines.get(url.searchParams.get('device'));
        return send(baseline ? 200 : 404, 'application/json', JSON.stringify(baseline || { error: 'No passing OFF baseline in this server session' }));
      }
      if (url.pathname === '/patterns' && patterns.filter(id => !id.startsWith('best-')).includes(url.searchParams.get('case'))) return send(200, 'text/html; charset=utf-8', consentPatternPage(url.searchParams.get('case')));
      if (url.pathname === '/manual' && !url.search) {
        const upstream = await fetch('http://127.0.0.1:8765/', { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (!upstream.ok) return send(502, 'text/plain', 'Original manual fixture server failed');
        const body = await upstream.text();
        // Integrity gate: proxy the original page without adding scripts or rewriting controls.
        if (!body.includes('id="scenario"') || !body.includes('id="show"') || !body.includes('const evidence={accept:0,reject:0,save:0')) return send(502, 'text/plain', 'Unexpected manual fixture page');
        return send(200, 'text/html; charset=utf-8', body);
      }
      if (['/fonts/space-grotesk.ttf', '/fonts/ibm-plex-mono.ttf'].includes(url.pathname)) return send(200, 'font/ttf', await readFile(path.join(root, 'extension/assets', url.pathname.slice(1))));
      return send(404, 'text/plain', 'Unknown resource');
    }
    if (request.method !== 'POST' || url.pathname !== '/results' || url.search) return send(405, 'text/plain', 'Unsupported request');
    if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') return send(403, 'text/plain', 'Same-origin JSON required');
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 128 * 1024) return send(413, 'text/plain', 'Evidence too large'); chunks.push(chunk); }
    let report;
    try { report = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, 'text/plain', 'Invalid JSON'); }
    if (!validReport(report)) return send(400, 'text/plain', 'Invalid evidence or inconsistent verdict');
    const file = `installed-${report.device}-${report.mode}-${new Date().toISOString().replace(/[:.]/g, '-')}-${report.runId}.json`;
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, file), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    if (report.mode === 'off') {
      baselines.delete(report.device);
      if (report.passed) baselines.set(report.device, { runId: report.runId, file });
    }
    console.log(`Saved ${path.join(output, file)}: ${report.passed ? 'PASS' : 'FAIL'}; expected popup delta ${report.expectedPopupDelta}`);
    return send(200, 'application/json', JSON.stringify({ saved: true, file, passed: report.passed }));
  } catch (error) { console.error(error.message); if (!response.headersSent) send(502, 'text/plain', 'Harness/upstream error. Start original manual-fixtures.mjs on port 8765.'); else response.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(selfCheck ? 0 : 8767, '127.0.0.1', resolve); });
origin = `http://127.0.0.1:${server.address().port}`;
if (selfCheck) {
  try {
    const html = await (await fetch(origin)).text();
    new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
    assert(!html.includes('<script src='));
    assert.equal((await fetch(`${origin}/engine.js`)).status, 404);
    assert.equal((await fetch(`${origin}/baseline?device=test`)).status, 404);
    for (const id of patterns.filter(id => !id.startsWith('best-'))) assert.equal(await (await fetch(`${origin}/patterns?case=${id}`)).text(), consentPatternPage(id));
    for (const font of ['space-grotesk', 'ibm-plex-mono']) assert((await (await fetch(`${origin}/fonts/${font}.ttf`)).arrayBuffer()).byteLength > 1000);
    assert.equal((await fetch(`${origin}/results`, { method: 'POST', headers: { Origin: 'http://external.invalid', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${origin}/results`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal(validReport({ passed: true, results: [] }), false);
    console.log('Instrument self-check PASS: 26 cases, browser-script syntax, exact pattern HTML, fonts, no served engine, missing baseline and invalid/cross-origin evidence rejected. No browser or installed extension exercised; no result evidence written.');
  } finally { await new Promise(resolve => server.close(resolve)); }
} else console.log(`${origin}/?device=iphone18pro — 26 visible installed-extension checks. Start manual server on 8765. OFF expected delta 0; enabled expected delta 3. Results: ${output}`);
