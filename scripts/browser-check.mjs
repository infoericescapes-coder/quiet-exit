import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Quiet Exit verification</title>
<style>body{font:18px system-ui;padding:40px}section{border:1px solid;padding:20px}button{padding:12px;margin:8px}</style>
<h1>Independent browser fixture</h1>
<button id="unrelated" onclick="window.unrelatedClicks++">Reject</button>
<script>
window.unrelatedClicks=0;window.acceptClicks=0;window.rejectClicks=0;
window.showBanner=()=>{
 const el=document.createElement('section');el.id='onetrust-banner-sdk';el.setAttribute('role','dialog');
 el.innerHTML='<h2>We use cookies</h2><button id="onetrust-accept-btn-handler">Accept all</button><button id="onetrust-reject-all-handler">Reject all</button>';
 document.body.append(el);
 el.querySelector('#onetrust-accept-btn-handler').onclick=()=>{window.acceptClicks++};
 el.querySelector('#onetrust-reject-all-handler').onclick=()=>{window.rejectClicks++;el.remove()};
};
</script></html>`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/') {
    response.setHeader('content-type', 'text/html');
    response.end(fixture);
    return;
  }
  // Only expose known extension asset directories to local test pages.
  if (/^\/(popup|assets)\/[a-zA-Z0-9_./-]+$/.test(url.pathname) && !url.pathname.includes('..')) {
    try {
      const file = path.join(root, 'extension', url.pathname);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png' };
      response.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
    return;
  }
  response.writeHead(404).end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
const failures = [];
try {
  // WebKit exercises the actual DOM engine, not Safari/iOS extension installation.
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    let browser;
    try {
      browser = await type.launch({ headless: true });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      for (const file of ['platforms.js', 'engine.js']) await page.addScriptTag({ path: path.join(root, 'extension/content', file) });
      await page.evaluate(() => {
        window.denials = [];
        window.enabled = true;
        QuietExitEngine.start({ isEnabled: () => window.enabled, onDenied: event => window.denials.push(event) });
      });
      await page.evaluate(() => window.showBanner());
      await page.waitForFunction(() => window.denials.length === 1);
      assert.deepEqual(await page.evaluate(() => [window.rejectClicks, window.acceptClicks, window.unrelatedClicks]), [1, 0, 0]);
      await page.evaluate(() => { window.enabled = false; QuietExitEngine.stop(); window.showBanner(); });
      await page.waitForTimeout(600);
      assert.equal(await page.locator('#onetrust-banner-sdk').count(), 1);
      assert.equal(await page.evaluate(() => window.denials.length), 1);
      await page.evaluate(() => {
        document.querySelector('#onetrust-banner-sdk').remove();
        window.savedStates = [];
        const banner = document.createElement('section');
        banner.id = 'onetrust-banner-sdk';
        banner.innerHTML = '<h2>Cookie preferences</h2><button id="onetrust-pc-btn-handler">Manage cookies</button>';
        document.body.append(banner);
        banner.querySelector('button').onclick = () => setTimeout(() => {
          banner.remove();
          const panel = document.createElement('section');
          panel.id = 'onetrust-pc-sdk';
          panel.innerHTML = '<div id="ot-pc-content"><div class="ot-cat-grp"><h3 class="ot-cat-header">Strictly necessary cookies</h3><span class="ot-always-active">Always active</span></div>' +
            '<div class="ot-cat-grp"><h3 class="ot-cat-header">Analytics</h3><div class="ot-switch"><button id="analytics" role="switch" aria-checked="true">Analytics</button></div></div></div>' +
            '<button class="save-preference-btn-handler">Save preferences</button>';
          document.body.append(panel);
          panel.querySelector('#analytics').onclick = event => setTimeout(() => event.target.setAttribute('aria-checked', 'false'), 80);
          panel.querySelector('.save-preference-btn-handler').onclick = () => {
            window.savedStates.push(panel.querySelector('#analytics').getAttribute('aria-checked'));
            panel.remove();
          };
        }, 80);
        window.enabled = true;
        QuietExitEngine.start({ isEnabled: () => window.enabled, onDenied: event => window.denials.push(event) });
      });
      await page.waitForFunction(() => window.denials.length === 2);
      assert.deepEqual(await page.evaluate(() => window.savedStates), ['false']);
      // The same apparently valid panel with an unclassified control must not save.
      await page.evaluate(() => {
        const panel = document.createElement('section');
        panel.id = 'CybotCookiebotDialog';
        panel.innerHTML = ['Necessary', 'Preferences', 'Statistics', 'Marketing'].map(category =>
          `<label>${category}<input type="checkbox" id="CybotCookiebotDialogBodyLevelButton${category}" ${category === 'Necessary' ? 'checked disabled' : ''}></label>`).join('') +
          '<input aria-label="Unknown optional purpose" type="checkbox" checked><button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection">Allow selection</button>';
        panel.querySelector('button').onclick = () => { window.savedStates.push('UNSAFE'); panel.remove(); };
        document.body.append(panel);
      });
      await page.waitForTimeout(600);
      assert.deepEqual(await page.evaluate(() => window.savedStates), ['false']);
      assert.equal(await page.locator('#CybotCookiebotDialog').count(), 1);
      assert.deepEqual(errors, []);
      results.push(`${name}: late rejection, unrelated/accept controls untouched, disable, async management and toggle verification, unknown preference blocks save`);
      // Safari starts its content-sized action popover at a tiny viewport.
      // Exercise the real popup CSS, which the DOM-only popup tests cannot do.
      const sizingPopup = await browser.newPage({ viewport: { width: 50, height: 600 } });
      await sizingPopup.addInitScript(() => {
        const saved = { enabled: true, deniedCount: 2 };
        window.browser = { storage: {
          local: { get: async () => ({ ...saved }), set: async value => Object.assign(saved, value) },
          onChanged: { addListener() {} },
        } };
      });
      await sizingPopup.goto(`${origin}/popup/popup.html`);
      await sizingPopup.waitForFunction(() => document.querySelector('#enabled').disabled === false);
      await sizingPopup.evaluate(() => document.fonts.ready);
      const measured = await sizingPopup.evaluate(() => ({
        rootWidth: document.documentElement.getBoundingClientRect().width,
        bodyWidth: document.body.getBoundingClientRect().width,
        background: getComputedStyle(document.documentElement).backgroundColor,
      }));
      assert.ok(measured.rootWidth >= 320 && measured.bodyWidth >= 320, `${name}: collapsed initial popup`);
      assert.equal(measured.background, 'rgb(5, 6, 5)');
      for (const width of [320, 321, 330, 340, 390]) {
        await sizingPopup.setViewportSize({ width, height: 600 });
        assert.ok(await sizingPopup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: popup overflows at ${width}`);
      }
      await sizingPopup.screenshot({ path: path.join(artifacts, `popup-${name}-sizing.png`), fullPage: true });
      results.push(`${name}: popup keeps intrinsic width during initial sizing and fits narrow mobile viewports`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    } finally { if (browser) await browser.close(); }
  }

  // Load the complete Chrome package including the real service worker and storage.
  const profile = await mkdtemp(path.join(tmpdir(), 'quiet-exit-check-'));
  let context;
  try {
    const extension = path.join(root, 'dist/chrome');
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(() => window.showBanner());
    await page.waitForFunction(() => window.rejectClicks === 1);
    await page.waitForTimeout(500);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    await popup.waitForFunction(async () => (await chrome.storage.local.get('deniedCount')).deniedCount === 1);
    const toggle = popup.getByRole('switch');
    await toggle.waitFor();
    await toggle.click();
    await popup.waitForFunction(async () => (await chrome.storage.local.get('enabled')).enabled === false);
    await page.evaluate(() => window.showBanner());
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#onetrust-banner-sdk').count(), 1);
    await toggle.click();
    await page.waitForFunction(() => window.rejectClicks === 2);
    await popup.waitForFunction(async () => (await chrome.storage.local.get('deniedCount')).deniedCount === 2);
    for (const width of [320, 390, 800]) {
      await popup.setViewportSize({ width, height: 640 });
      await popup.evaluate(() => document.fonts.ready);
      assert.ok(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `popup overflows at ${width}`);
      await popup.screenshot({ path: path.join(artifacts, `popup-${width}.png`), fullPage: true });
    }
    await popup.emulateMedia({ reducedMotion: 'reduce' });
    await popup.keyboard.press('Tab');
    await popup.screenshot({ path: path.join(artifacts, 'popup-reduced-motion.png'), fullPage: true });
    results.push('Chromium extension: packaged content scripts, service worker, counter, live popup toggle, local fonts and responsive screenshots');
  } finally {
    if (context) await context.close();
    await rm(profile, { recursive: true, force: true });
  }
  console.log(results.join('\n'));
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
