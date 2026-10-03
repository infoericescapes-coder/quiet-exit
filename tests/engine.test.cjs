const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const contentDir = path.join(__dirname, '..', 'extension', 'content');
const scripts = ['platforms.js', 'engine.js'].map((name) => fs.readFileSync(path.join(contentDir, name), 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeout = 3500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (predicate()) return; await sleep(20); }
  assert.ok(predicate(), 'condition did not arrive before timeout');
}
function fixture(t, html = '') {
  const dom = new JSDOM(`<body>${html}</body>`, { runScripts: 'outside-only', url: 'https://example.test' });
  const w = dom.window;
  scripts.forEach((source) => w.eval(source));
  const events = [];
  let enabled = true;
  const start = () => w.QuietExitEngine.start({ onDenied: (event) => events.push(event), isEnabled: () => enabled });
  const disable = () => { enabled = false; w.QuietExitEngine.stop(); };
  t.after(() => { w.QuietExitEngine.stop(); w.close(); });
  return { w, doc: w.document, events, start, disable };
}
const banner = (id = 'onetrust-banner-sdk') => `<div id="${id}"><p>We use cookies for tracking. Privacy preferences.</p><button id="onetrust-accept-btn-handler">Accept all</button><button id="onetrust-reject-all-handler">Reject all</button></div>`;
const cookieControls = () => ['Necessary', 'Preferences', 'Statistics', 'Marketing'].map((name) => `<input type="checkbox" checked ${name === 'Necessary' ? 'disabled' : ''} id="CybotCookiebotDialogBodyLevelButton${name}">`).join('');
const cookiePanel = (extra = '') => `<div id="CybotCookiebotDialog">${cookieControls()}${extra}<button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection">Allow selection</button><button>Accept all</button></div>`;
function saveOnRemove(f, selector) {
  let saves = 0;
  f.doc.querySelector(selector).addEventListener('click', (event) => { saves += 1; event.target.closest('#CybotCookiebotDialog, #onetrust-pc-sdk, .cookie-modal').remove(); });
  return () => saves;
}
test('direct reliable rejection counts only a completed disappearance, once per instance', async (t) => {
  const f = fixture(t, banner());
  let accepts = 0, rejects = 0;
  const root = f.doc.getElementById('onetrust-banner-sdk');
  f.doc.querySelector('#onetrust-accept-btn-handler').onclick = () => accepts++;
  f.doc.querySelector('#onetrust-reject-all-handler').onclick = () => { rejects++; setTimeout(() => root.remove(), 80); };
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(accepts, 0);
  assert.equal(rejects, 1);
  assert.equal(f.events[0].platform, 'OneTrust');
  assert.match(f.events[0].eventId, /.+/);
  f.doc.body.append(root);
  root.append(f.doc.createElement('span'));
  await sleep(350);
  assert.equal(rejects, 1);
  assert.equal(f.events.length, 1);
});
test('negative controls: unrelated reject, accept, close, hidden and disabled reject untouched', async (t) => {
  const f = fixture(t, `<button>Reject</button><div role="dialog">Delete project? <button>Reject</button></div>
    <div id="didomi-notice"><p>Cookie consent</p><button>Accept all</button><button>Close</button><button hidden>Reject all</button><button disabled>Deny</button><span style="display:none"><button>Only necessary</button></span><button aria-label="Accept all">Reject all</button></div>`);
  let clicks = 0;
  f.doc.addEventListener('click', () => clicks++);
  f.start();
  await sleep(350);
  assert.equal(clicks, 0);
  assert.equal(f.events.length, 0);
});
for (const [platform, scope] of [['Quantcast', 'class="qc-cmp2-ui"'], ['Didomi', 'id="didomi-notice"'], ['Osano', 'class="osano-cm-dialog"'], ['Complianz', 'class="cmplz-cookiebanner"'], ['Iubenda', 'id="iubenda-cs-banner"']]) {
  test(`${platform} uses exact scoped English denial`, async (t) => {
    const f = fixture(t, `<div ${scope}><p>Cookie consent</p><button>Accept all</button><button>Deny all</button></div>`);
    f.doc.querySelectorAll('button')[1].onclick = (e) => e.target.parentElement.remove();
    f.start();
    await waitFor(() => f.events.length === 1);
    assert.equal(f.events[0].platform, platform);
  });
}
test('generic cookie dialog exact safe text works; partial text does not', async (t) => {
  const f = fixture(t, `<div role="dialog"><p>We use cookies. Privacy preferences</p><button>Reject project</button><button>Continue without accepting</button></div>`);
  let wrong = 0;
  f.doc.querySelector('button').onclick = () => wrong++;
  f.doc.querySelectorAll('button')[1].onclick = (e) => e.target.parentElement.remove();
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(wrong, 0);
});
test('generic invitation dialog mentioning privacy and cookie settings is untouched', async (t) => {
  const f = fixture(t, '<section role="dialog"><h2>Invitation to collaborate</h2><p>Accept this invitation? Read our privacy and cookie settings.</p><button id="reject">Reject</button><button>Accept</button></section>');
  let clicks = 0;
  f.doc.querySelector('#reject').onclick = (event) => { clicks++; event.target.parentElement.remove(); };
  f.start();
  await sleep(350);
  assert.equal(clicks, 0);
  assert.equal(f.events.length, 0);
  assert.ok(f.doc.querySelector('section'));
});
test('Quantcast removing the inner dialog while retaining an empty mount confirms disappearance', async (t) => {
  const f = fixture(t, '<div class="qc-cmp2-container"><div class="qc-cmp2-ui">Cookie consent<button>Reject all</button></div></div>');
  f.doc.querySelector('button').onclick = (event) => event.target.parentElement.remove();
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.ok(f.doc.querySelector('.qc-cmp2-container'));
});
test('replacing a consent dialog with an embedded preferences frame does not count', async (t) => {
  const f = fixture(t, '<div class="qc-cmp2-container"><div class="qc-cmp2-ui"><h2>Cookie consent</h2><button>Reject all</button></div></div>');
  f.doc.querySelector('button').onclick = () => {
    f.doc.querySelector('.qc-cmp2-container').innerHTML = '<iframe title="Cookie privacy preferences"></iframe>';
  };
  f.start();
  await sleep(2600);
  assert.equal(f.doc.querySelectorAll('iframe').length, 1);
  assert.equal(f.events.length, 0);
});
test('reliable reject selector does not override an explicit negated or accepting label', async (t) => {
  const f = fixture(t, banner());
  const reject = f.doc.querySelector('#onetrust-reject-all-handler');
  reject.textContent = 'Do not reject';
  let clicks = 0;
  reject.onclick = () => clicks++;
  f.start();
  await sleep(200);
  reject.textContent = 'Accept all';
  await sleep(200);
  assert.equal(clicks, 0);
});
test('observer detects late inserted banner and attribute visibility changes', async (t) => {
  const f = fixture(t);
  f.start();
  f.doc.body.innerHTML = `<div style="display:none">${banner()}</div>`;
  const reject = f.doc.querySelector('#onetrust-reject-all-handler');
  let clicks = 0;
  reject.onclick = () => { clicks++; f.doc.querySelector('#onetrust-banner-sdk').remove(); };
  await sleep(150);
  assert.equal(clicks, 0);
  f.doc.body.firstElementChild.style.display = 'block';
  await waitFor(() => f.events.length === 1);
  assert.equal(clicks, 1);
});
test('Cookiebot only saves after every optional native checkbox is off', async (t) => {
  const f = fixture(t, cookiePanel());
  let clicks = 0;
  f.doc.querySelectorAll('input:not(:disabled)').forEach((input) => input.addEventListener('click', () => clicks++));
  const saves = saveOnRemove(f, '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection');
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(clicks, 3);
  assert.equal(saves(), 1);
});
for (const [name, hostTag, mode, hostIsPanel] of [
  ['open custom-element root', 'cookie-options', 'open', false],
  ['closed custom-element root', 'cookie-options', 'closed', false],
  ['open native-element root', 'div', 'open', false],
  ['open root on the panel itself', 'div', 'open', true]
]) {
  test(`preferences refuse a supported light DOM panel mixed with ${name}`, async (t) => {
    const f = fixture(t, cookiePanel());
    const panel = f.doc.getElementById('CybotCookiebotDialog');
    const host = hostIsPanel ? panel : panel.appendChild(f.doc.createElement(hostTag));
    const shadow = host.attachShadow({ mode });
    const optional = f.doc.createElement('input');
    optional.type = 'checkbox';
    optional.checked = true;
    shadow.appendChild(optional);
    assert.equal(host.shadowRoot, mode === 'closed' ? null : shadow);
    let clicks = 0;
    f.doc.addEventListener('click', () => clicks++);
    optional.addEventListener('click', () => clicks++);
    const saves = saveOnRemove(f, '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection');
    f.start();
    await sleep(600);
    assert.equal(clicks, 0);
    assert.equal(saves(), 0);
    assert.equal(f.events.length, 0);
    assert.equal(optional.checked, true);
    assert.ok(Array.from(panel.querySelectorAll('input')).every((control) => control.checked));
  });
}
for (const [name, extra, prepare] of [
  ['unknown checkbox', '<input type="checkbox" checked>', () => {}],
  ['uninitialised custom element', '<cookie-options></cookie-options>', () => {}],
  ['custom panel element', '', (f) => {
    const panel = f.doc.getElementById('CybotCookiebotDialog');
    const custom = f.doc.createElement('cookie-preferences');
    custom.id = panel.id;
    custom.append(...panel.childNodes);
    panel.replaceWith(custom);
  }],
  ['customised built-in element', '<div is="cookie-options"></div>', () => {}],
  ['embedded frame', '<iframe title="Optional cookie choices"></iframe>', () => {}],
  ['embedded object', '<object data="about:blank"></object>', () => {}],
  ['embedded content', '<embed src="about:blank">', () => {}],
  ['canvas controls', '<canvas></canvas>', () => {}],
  ['unknown state', '', (f) => { const c = f.doc.getElementById('CybotCookiebotDialogBodyLevelButtonMarketing'); c.indeterminate = true; }],
  ['disabled optional-on', '', (f) => { f.doc.getElementById('CybotCookiebotDialogBodyLevelButtonMarketing').disabled = true; }],
  ['disabled optional-off', '', (f) => { const c = f.doc.getElementById('CybotCookiebotDialogBodyLevelButtonMarketing'); c.disabled = true; c.checked = false; }],
  ['collapsed categories', '<button aria-expanded="false">More categories</button>', () => {}],
  ['vendor controls', '<section hidden id="vendor-options">Vendors</section>', () => {}],
  ['legitimate interest', '<p>Legitimate interest purposes</p>', () => {}],
  ['hidden optional control', '', (f) => { f.doc.getElementById('CybotCookiebotDialogBodyLevelButtonMarketing').hidden = true; }],
  ['missing optional category', '', (f) => { f.doc.getElementById('CybotCookiebotDialogBodyLevelButtonMarketing').remove(); }]
]) {
  test(`preferences fail closed for ${name}`, async (t) => {
    const f = fixture(t, cookiePanel(extra));
    prepare(f);
    let clicks = 0;
    f.doc.addEventListener('click', () => clicks++);
    f.start();
    await sleep(350);
    assert.equal(clicks, 0);
    assert.equal(f.events.length, 0);
  });
}
test('OneTrust complete category panel handles ARIA switch asynchronously', async (t) => {
  const f = fixture(t, `<div id="onetrust-pc-sdk"><div id="ot-pc-content">
    <section class="ot-cat-grp"><h3 class="ot-cat-header">Strictly necessary cookies</h3><span class="ot-always-active">Always active</span></section>
    <section class="ot-cat-grp"><h3 class="ot-cat-header">Analytics</h3><div class="ot-switch"><button id="analytics" role="switch" aria-checked="true">Analytics</button></div></section>
    <section class="ot-cat-grp"><h3 class="ot-cat-header">Marketing</h3><div class="ot-switch"><input id="marketing" type="checkbox" checked></div></section>
    </div><button class="save-preference-btn-handler">Confirm my choices</button><button>Accept all</button></div>`);
  let toggles = 0;
  f.doc.querySelector('#analytics').onclick = (event) => { toggles++; setTimeout(() => event.target.setAttribute('aria-checked', 'false'), 110); };
  const saves = saveOnRemove(f, '.save-preference-btn-handler');
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(toggles, 1);
  assert.equal(saves(), 1);
});
test('Klaro flat service list saves selected consent after disabling every optional service', async (t) => {
  const f = fixture(t, `<div class="klaro"><div class="cookie-modal"><div class="cm-body"><ul class="cm-services">
    <li class="cm-service"><input class="cm-list-input required" id="service-item-essential" type="checkbox" checked disabled><label for="service-item-essential"><span class="cm-required">Required</span></label></li>
    <li class="cm-service"><input class="cm-list-input" id="service-item-analytics" type="checkbox" checked><label for="service-item-analytics">Analytics</label></li>
    <li class="cm-service"><input class="cm-list-input" id="service-item-advertising" type="checkbox"><label for="service-item-advertising">Advertising</label></li>
    </ul></div><div class="cm-footer"><button class="cm-btn-accept">Accept selected</button><button class="cm-btn-accept-all">Accept all</button></div></div></div>`);
  const saves = saveOnRemove(f, '.cm-btn-accept');
  let acceptAll = 0;
  f.doc.querySelector('.cm-btn-accept-all').onclick = () => acceptAll++;
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(saves(), 1);
  assert.equal(acceptAll, 0);
});
test('Klaro grouped purpose panels cannot save an unenumerated service list', async (t) => {
  const f = fixture(t, '<div class="klaro"><div class="cookie-modal"><div class="cm-body"><ul class="cm-purposes"><li>Analytics<input type="checkbox" checked></li></ul></div><div class="cm-footer"><button class="cm-btn-accept">Accept selected</button></div></div></div>');
  let clicks = 0;
  f.doc.addEventListener('click', () => clicks++);
  f.start();
  await sleep(350);
  assert.equal(clicks, 0);
  assert.equal(f.events.length, 0);
});
test('OneTrust categories without an inspectable optional control cannot save', async (t) => {
  const f = fixture(t, '<div id="onetrust-pc-sdk"><div id="ot-pc-content"><section class="ot-cat-grp"><h3 class="ot-cat-header">Analytics</h3><span>Enabled</span></section></div><button class="save-preference-btn-handler">Confirm my choices</button></div>');
  let clicks = 0;
  f.doc.addEventListener('click', () => clicks++);
  f.start();
  await sleep(350);
  assert.equal(clicks, 0);
});
test('asynchronous management panel and replacing native toggles are re-read before save', async (t) => {
  const f = fixture(t, `<div id="CybotCookiebotDialog"><p>Cookie consent</p><button id="CybotCookiebotDialogBodyButtonDetails">Manage preferences</button></div>`);
  let saves = 0;
  f.doc.querySelector('button').onclick = () => setTimeout(() => {
    f.doc.getElementById('CybotCookiebotDialog').innerHTML = cookieControls() + '<button id="CybotCookiebotDialogBodyLevelButtonAccept">Allow selection</button>';
    f.doc.querySelectorAll('input:not(:disabled)').forEach((input) => input.addEventListener('click', (event) => {
      event.preventDefault();
      setTimeout(() => {
        const fresh = input.cloneNode(true); fresh.checked = false; input.replaceWith(fresh);
      }, 100);
    }));
    f.doc.querySelector('button').onclick = () => { saves++; f.doc.getElementById('CybotCookiebotDialog').remove(); };
  }, 120);
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(saves, 1);
});
test('disable during asynchronous toggle prevents further clicks and saves', async (t) => {
  const f = fixture(t, cookiePanel());
  let clicks = 0, saves = 0;
  f.doc.querySelector('input:not(:disabled)').onclick = (event) => {
    event.preventDefault(); clicks++;
    setTimeout(() => { event.target.checked = false; }, 150);
    setTimeout(f.disable, 30);
  };
  f.doc.querySelector('button').onclick = () => saves++;
  f.start();
  await sleep(500);
  assert.equal(clicks, 1);
  assert.equal(saves, 0);
  assert.equal(f.events.length, 0);
});
test('disable during asynchronous management prevents toggles in newly rendered panel', async (t) => {
  const f = fixture(t, `<div id="CybotCookiebotDialog"><button id="CybotCookiebotDialogBodyButtonDetails">Manage preferences</button></div>`);
  let clicks = 0;
  f.doc.querySelector('button').onclick = () => {
    setTimeout(f.disable, 30);
    setTimeout(() => { f.doc.body.innerHTML = cookiePanel(); }, 100);
  };
  f.doc.addEventListener('click', () => clicks++);
  f.start();
  await sleep(500);
  assert.equal(clicks, 1);
  assert.equal(f.events.length, 0);
});
test('failed direct rejection is bounded to three attempts without fabricated counts', async (t) => {
  const f = fixture(t, banner());
  let clicks = 0;
  f.doc.querySelector('#onetrust-reject-all-handler').onclick = () => { clicks++; f.doc.querySelector('p').textContent += '.'; };
  f.start();
  await waitFor(() => clicks === 3, 9500);
  await sleep(2500);
  assert.equal(clicks, 3);
  assert.equal(f.events.length, 0);
});
test('replacing the banner with a preferences dialog after Reject does not count as success', async (t) => {
  const f = fixture(t, banner());
  f.doc.querySelector('#onetrust-reject-all-handler').onclick = () => { f.doc.body.innerHTML = '<div id="onetrust-pc-sdk">Cookie privacy preferences are still open</div>'; };
  f.start();
  await sleep(2600);
  assert.equal(f.events.length, 0);
});
test('content wiring defaults enabled, respects storage change races, and emits minimal completed event', async (t) => {
  const f = fixture(t, banner());
  let listener, resolveRead;
  const sent = [];
  f.w.chrome = { storage: { local: { get: () => new Promise((resolve) => { resolveRead = resolve; }) }, onChanged: { addListener: (cb) => { listener = cb; } } }, runtime: { sendMessage: (value) => { sent.push(value); return Promise.resolve(); } } };
  f.doc.querySelector('#onetrust-reject-all-handler').onclick = (e) => e.target.parentElement.remove();
  f.w.eval(fs.readFileSync(path.join(contentDir, 'content.js'), 'utf8'));
  listener({ enabled: { newValue: false } }, 'local');
  resolveRead({ enabled: true });
  await sleep(150);
  assert.equal(sent.length, 0);
  listener({ enabled: {} }, 'local');
  await waitFor(() => sent.length === 1);
  assert.deepEqual(Object.keys(sent[0]).sort(), ['eventId', 'platform', 'type']);
  assert.equal(sent[0].type, 'banner-denied');
});
test('content resumes after a persisted pageshow using current stored enabled preference', async (t) => {
  const f = fixture(t);
  let stored = { enabled: true };
  const sent = [];
  f.w.browser = { storage: { local: { get: () => Promise.resolve(stored) }, onChanged: { addListener: () => {} } }, runtime: { sendMessage: (value) => { sent.push(value); return Promise.resolve(); } } };
  f.w.eval(fs.readFileSync(path.join(contentDir, 'content.js'), 'utf8'));
  await sleep(40);
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide', { persisted: true }));
  f.doc.body.innerHTML = banner();
  f.doc.querySelector('#onetrust-reject-all-handler').onclick = (e) => e.target.parentElement.remove();
  await sleep(150);
  assert.equal(sent.length, 0);
  stored = { enabled: false };
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow', { persisted: true }));
  await sleep(150);
  assert.equal(sent.length, 0);
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide', { persisted: true }));
  stored = {};
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow', { persisted: true }));
  await waitFor(() => sent.length === 1);
});
