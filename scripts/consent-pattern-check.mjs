import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patterns, consentPatternPage } from '../tests/fixtures/consent-patterns.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const results = [];
const sources = ['platforms.js', 'engine.js'];
const identities = Object.fromEntries(await Promise.all(sources.map(async file => [file,
  createHash('sha256').update(await readFile(path.join(root, 'extension/content', file))).digest('hex')])));
const fonts = new Map(await Promise.all(['space-grotesk.ttf', 'ibm-plex-mono.ttf'].map(async file =>
  [`/fonts/${file}`, await readFile(path.join(root, 'extension/assets/fonts', file))])));

async function exercise(context, kind, lane, worker) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = `https://${kind.startsWith('best-') ? 'www.bestlawyers.com' : 'quiet-exit.example'}/__fixture__/${kind}`;
  // Every document is a local, synthetic response; no production site is contacted.
  await page.route('**/*', route => {
    const requestURL = new URL(route.request().url());
    if (route.request().isNavigationRequest() && requestURL.href === url) {
      return route.fulfill({ contentType: 'text/html', body: consentPatternPage(kind) });
    }
    if (requestURL.origin === new URL(url).origin && fonts.has(requestURL.pathname)) {
      return route.fulfill({ contentType: 'font/ttf', body: fonts.get(requestURL.pathname) });
    }
    return route.abort();
  });
  const previousCount = worker ? await worker.evaluate(async () => (await chrome.storage.local.get('deniedCount')).deniedCount || 0) : 0;
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('16px "Space Grotesk"') && document.fonts.check('13px "IBM Plex Mono"')),
    `${lane}/${kind}: bundled fixture fonts loaded`);
  if (!worker) {
    for (const file of sources) await page.addScriptTag({ path: path.join(root, 'extension/content', file) });
    await page.evaluate(() => {
      window.patternEvents = [];
      QuietExitEngine.start({ onDenied: event => window.patternEvents.push(event) });
    });
  }
  const positive = kind === 'best-desktop' || kind === 'best-mobile';
  if (positive) await page.waitForFunction(() => window.patternState.reject === 1);
  const clickedFailure = ['best-missing-cookie', 'best-accept-cookie', 'best-stays-visible', 'best-replacement-dialog', 'opaque-replacement'].includes(kind);
  await page.waitForTimeout(clickedFailure ? 2800 : 700);
  const state = await page.evaluate(() => ({
    ...window.patternState,
    choice: document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith('bl_cookie_policy_V4=')) || null,
    events: window.patternEvents?.length,
    bannerPresent: !!document.querySelector('.cookie-notice'),
    preferencesPresent: !!document.querySelector('[role="dialog"] input[type="checkbox"]'),
  }));
  const completed = worker
    ? (await worker.evaluate(async () => (await chrome.storage.local.get('deniedCount')).deniedCount || 0)) - previousCount
    : state.events;
  assert.equal(state.accept, 0, `${lane}/${kind}: acceptance must never be clicked`);
  assert.equal(state.other, 0, `${lane}/${kind}: subscription, acknowledgement and unknown actions stay untouched`);
  assert.equal(state.optionalConsent, kind === 'best-accept-cookie',
    `${lane}/${kind}: consent stays false except the deliberately broken essential-only handler, which must never count as success`);
  assert.equal(completed, positive ? 1 : 0, `${lane}/${kind}: completion requires the expected evidence`);
  if (positive) {
    assert.equal(state.reject, 1);
    assert.equal(state.choice, 'bl_cookie_policy_V4=0');
    assert.equal(state.bannerPresent, false);
  } else if (!clickedFailure) assert.equal(state.reject, 0);
  else {
    assert.ok(state.reject >= 1 && state.reject <= 3, `${lane}/${kind}: bounded deliberate attempt`);
    if (kind === 'best-missing-cookie') assert.equal(state.choice, null);
    if (kind === 'best-accept-cookie') assert.equal(state.choice, 'bl_cookie_policy_V4=1');
    if (kind === 'best-stays-visible') assert.equal(state.bannerPresent, true);
    if (kind === 'best-replacement-dialog') assert.equal(state.preferencesPresent, true);
  }
  if (kind === 'opacity-label') assert.equal(await page.getByRole('button', { name: 'Reject all Accept all', exact: true }).count(), 1,
    'Opacity-hidden wording remains in the browser accessible name');
  if (kind === 'associated-label') assert.equal(await page.getByRole('button', { name: 'Accept all', exact: true }).count(), 1,
    'Native associated labels determine the browser accessible name');
  if (kind === 'generated-label') assert.equal(await page.getByRole('button', { name: 'Reject all Accept all', exact: true }).count(), 1,
    'Generated text contributes to the browser accessible name');
  assert.deepEqual(errors, [], `${lane}/${kind}: page exceptions`);
  results.push({ lane, kind, ...state, completed });
  await page.close();
}

try {
  for (const [lane, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      for (const kind of patterns) {
        const context = await browser.newContext();
        try { await exercise(context, kind, lane); } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  const profile = await mkdtemp(path.join(tmpdir(), 'quiet-exit-patterns-'));
  let context;
  try {
    const extension = path.join(root, 'dist/chrome');
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    for (const kind of ['best-desktop', 'best-accept-cookie', 'frandroid-accept-only', 'opaque-replacement']) {
      await context.clearCookies();
      await exercise(context, kind, 'packaged-chromium', worker);
    }
  } finally {
    if (context) await context.close();
    await rm(profile, { recursive: true, force: true });
  }
  console.log(`Consent-pattern checks passed: ${results.length} cases across Chromium, WebKit and the loaded Chromium package.`);
} finally {
  await writeFile(path.join(artifacts, 'consent-pattern-results.json'), JSON.stringify({
    at: new Date().toISOString(), sources: identities,
    scope: 'Synthetic local documents at intercepted URLs; DOM-engine and packaged Chromium evidence, not live-site or native Safari proof.',
    complete: results.length === patterns.length * 2 + 4, results,
  }, null, 2) + '\n');
}
