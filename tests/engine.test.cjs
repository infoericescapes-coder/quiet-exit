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
function fixture(t, html = '', url = 'https://example.test') {
  const dom = new JSDOM(`<body>${html}</body>`, { runScripts: 'outside-only', url });
  const w = dom.window;
  // jsdom does not implement pseudo-element computed styles. Stub only that
  // browser primitive; ordinary visibility still uses its real computed styles.
  const computedStyle = w.getComputedStyle.bind(w);
  w.getComputedStyle = (element, pseudo) => pseudo ? { content: 'none' } : computedStyle(element);
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
test('known reject IDs and classes require exact affirmative English refusal wording', async (t) => {
  const labels = ['', 'Continue', 'OK', 'Got it', 'Close', 'Withdraw consent', 'Subscribe', 'Pay to continue',
    'J’accepte les cookies', 'Accepter et continuer', 'Do not reject', 'Reject optional cookies and accept analytics'];
  for (const selector of ['id="onetrust-reject-all-handler"', 'class="ot-pc-refuse-all-handler"']) {
    for (const wording of labels) {
      const f = fixture(t, `<div id="onetrust-banner-sdk"><p>Cookie consent</p><button ${selector}>${wording}</button></div>`);
      let clicks = 0;
      f.doc.querySelector('button').onclick = () => clicks++;
      f.start();
      await sleep(110);
      f.disable();
      assert.equal(clicks, 0, `${selector}: ${wording || '(blank)'}`);
      assert.equal(f.events.length, 0);
    }
  }
});
test('refusal requires agreement between visible wording and each accessible name', async (t) => {
  for (const markup of [
    '<button id="onetrust-reject-all-handler" aria-label="Reject all">Accept all</button>',
    '<button id="onetrust-reject-all-handler" aria-label="Accept all">Reject all</button>',
    '<button id="onetrust-reject-all-handler" aria-label="Reject all" aria-labelledby="other">Reject all</button><span id="other">Subscribe</span>',
    '<button aria-labelledby="other">Accept all</button><span id="other">Reject all</span>',
    '<button aria-labelledby="missing">Reject all</button>',
    '<button>Reject all<span aria-label="Accept all"></span></button>',
    '<button><span aria-hidden="true">Reject all</span></button>',
    '<button>Reject all<img alt="Accept all"></button>',
    '<button aria-labelledby="other">Reject all</button><span id="other" aria-label="Accept all">Reject all</span>',
    '<button aria-label="">Reject all</button>'
  ]) {
    const f = fixture(t, `<div id="onetrust-banner-sdk">Cookie consent${markup}</div>`);
    let clicks = 0;
    f.doc.addEventListener('click', () => clicks++);
    f.start();
    await sleep(110);
    f.disable();
    assert.equal(clicks, 0, markup);
    assert.equal(f.events.length, 0);
  }
});
test('hidden descendant text cannot change reject, manage or save meaning', async (t) => {
  for (const [name, markup] of [
    ['reject', banner()],
    ['manage', '<div id="CybotCookiebotDialog">Cookie consent<button id="CybotCookiebotDialogBodyButtonDetails">Manage cookies</button></div>'],
    ['save', cookiePanel()]
  ]) {
    const f = fixture(t, markup);
    const button = name === 'reject' ? f.doc.getElementById('onetrust-reject-all-handler') : f.doc.querySelector('button');
    button.innerHTML += '<span style="opacity:0"> Accept all</span>';
    let clicks = 0;
    f.doc.addEventListener('click', () => clicks++);
    f.start();
    await sleep(150);
    f.disable();
    assert.equal(clicks, 0, name);
    assert.equal(f.events.length, 0, name);
  }
});
test('opaque hosts and action descendants stay untouched, including unobservable native closed roots', async (t) => {
  for (const [name, tag, childTag, mode, customised] of [
    ['closed native role host', 'div', null, 'closed'],
    ['open native role host', 'div', null, 'open'],
    ['custom role host', 'cookie-choice', null, 'closed'],
    ['uninitialised custom descendant', 'button', 'cookie-choice'],
    ['open custom descendant', 'button', 'cookie-choice', 'open'],
    ['closed custom descendant', 'button', 'cookie-choice', 'closed'],
    ['open native descendant', 'button', 'span', 'open'],
    ['closed native descendant', 'button', 'span', 'closed'],
    ['customised action', 'button', null, null, true],
    ['customised descendant', 'button', 'span', null, true]
  ]) {
    const f = fixture(t, '<div id="onetrust-banner-sdk">Cookie consent</div>');
    const action = f.doc.createElement(tag);
    action.id = 'onetrust-reject-all-handler';
    action.setAttribute('role', 'button');
    action.textContent = 'Reject all';
    const host = childTag ? action.appendChild(f.doc.createElement(childTag)) : action;
    if (customised) host.setAttribute('is', 'cookie-choice');
    if (mode) host.attachShadow({ mode }).innerHTML = '<span>Accept all</span>';
    f.doc.getElementById('onetrust-banner-sdk').appendChild(action);
    let clicks = 0;
    action.onclick = () => { clicks++; action.parentElement.remove(); };
    f.start();
    await sleep(150);
    f.disable();
    assert.equal(clicks, 0, name);
    assert.equal(f.events.length, 0, name);
  }
});
test('plain native buttons, links and button inputs remain supported', async (t) => {
  for (const markup of [
    '<button aria-label="Reject all">Reject all</button>', '<a href="#">Reject all</a>',
    '<input type="button" value="Reject all">', '<input type="submit" value="Reject all">'
  ]) {
    const f = fixture(t, `<div id="onetrust-banner-sdk">Cookie consent${markup}</div>`);
    let clicks = 0;
    f.doc.querySelector('button, a, input').onclick = (event) => { event.preventDefault(); clicks++; event.target.parentElement.remove(); };
    f.start();
    await waitFor(() => f.events.length === 1);
    assert.equal(clicks, 1, markup);
  }
});
test('native associated labels cannot contradict reject, manage or save wording', async (t) => {
  for (const [name, markup] of [
    ['reject', banner()],
    ['manage', '<div id="CybotCookiebotDialog">Cookie consent<button id="CybotCookiebotDialogBodyButtonDetails">Manage cookies</button></div>'],
    ['save', cookiePanel()]
  ]) {
    for (const type of name === 'reject' ? ['button', 'input-button', 'input-submit'] : ['button']) {
      for (const association of ['explicit', 'implicit']) {
        const f = fixture(t, markup);
        let action = name === 'reject' ? f.doc.getElementById('onetrust-reject-all-handler') : f.doc.querySelector('button');
        if (type !== 'button') {
          const input = f.doc.createElement('input');
          input.type = type.slice(6);
          input.value = action.textContent;
          input.id = action.id;
          action.replaceWith(input);
          action = input;
        }
        const label = f.doc.createElement('label');
        label.textContent = 'Accept all';
        if (association === 'explicit') { label.htmlFor = action.id; f.doc.body.appendChild(label); }
        else { action.replaceWith(label); label.appendChild(action); }
        assert.equal(action.labels.length, 1, `${name}: ${type}: ${association}`);
        let clicks = 0;
        f.doc.addEventListener('click', () => clicks++);
        f.start();
        await sleep(120);
        f.disable();
        assert.equal(clicks, 0, `${name}: ${type}: ${association}`);
        assert.equal(f.events.length, 0);
      }
    }
  }
});
test('computed pseudo wording blocks reject, manage and save actions', async (t) => {
  for (const [name, markup] of [
    ['reject', banner()],
    ['manage', '<div id="CybotCookiebotDialog">Cookie consent<button id="CybotCookiebotDialogBodyButtonDetails">Manage cookies</button></div>'],
    ['save', cookiePanel()]
  ]) {
    for (const pseudo of ['::before', '::after']) {
      const f = fixture(t, markup);
      const action = name === 'reject' ? f.doc.getElementById('onetrust-reject-all-handler') : f.doc.querySelector('button');
      const computedStyle = f.w.getComputedStyle;
      f.w.getComputedStyle = (element, selectedPseudo) => element === action && selectedPseudo === pseudo
        ? { content: '"Accept all"' } : computedStyle(element, selectedPseudo);
      let clicks = 0;
      f.doc.addEventListener('click', () => clicks++);
      f.start();
      await sleep(120);
      f.disable();
      assert.equal(clicks, 0, `${name}: ${pseudo}`);
      assert.equal(f.events.length, 0);
    }
  }
});
test('unknown, unavailable and other generated pseudo content fails closed', async (t) => {
  for (const content of [undefined, null, '', '" "', 'url("consent.svg")', 'attr(title)', 'throw']) {
    const f = fixture(t, banner());
    const action = f.doc.getElementById('onetrust-reject-all-handler');
    const computedStyle = f.w.getComputedStyle;
    f.w.getComputedStyle = (element, pseudo) => {
      if (element === action && pseudo === '::after') {
        if (content === 'throw') throw new Error('pseudo style unavailable');
        return { content };
      }
      return computedStyle(element, pseudo);
    };
    let clicks = 0;
    action.onclick = () => clicks++;
    f.start();
    await sleep(120);
    f.disable();
    assert.equal(clicks, 0, String(content));
    assert.equal(f.events.length, 0);
  }
});
test('established empty or non-rendering pseudo content preserves plain native actions', async (t) => {
  for (const content of ['none', 'normal', '""', "''"]) {
    const f = fixture(t, banner());
    const computedStyle = f.w.getComputedStyle;
    f.w.getComputedStyle = (element, pseudo) => pseudo ? { content } : computedStyle(element);
    let clicks = 0;
    f.doc.getElementById('onetrust-reject-all-handler').onclick = (event) => { clicks++; event.target.parentElement.remove(); };
    f.start();
    await waitFor(() => f.events.length === 1);
    assert.equal(clicks, 1, content);
  }
});
test('Frandroid and Télérama accept-only consent surfaces remain untouched', async (t) => {
  const f = fixture(t, '<div id="didomi-notice">Cookie consent<button>J’accepte les cookies</button><button>Je rejoins Frandroid+</button></div><div role="dialog"><h2>Cookie consent</h2><button>Accepter et continuer</button><button>Paramétrer les cookies</button></div>');
  let clicks = 0;
  f.doc.addEventListener('click', () => clicks++);
  f.start();
  await sleep(350);
  assert.equal(clicks, 0);
  assert.equal(f.events.length, 0);
});
const bestLawyersNotice = (id = 'onlyEssentialCookies', attributes = '') => `<div class="cookie-notice" data-cookie-name="bl_cookie_policy_V4" ${attributes}><p>Cookie consent</p><button id="${id}">Only Use Essential Cookies</button><button id="acceptAllCookies">Accept All Cookies</button><button id="close">Close</button></div>`;
for (const [host, id] of [['bestlawyers.com', 'onlyEssentialCookies'], ['www.bestlawyers.com', 'onlyEssentialCookiesMobile']]) {
  test(`Best Lawyers ${id} requires its exact essential-only cookie outcome on ${host}`, async (t) => {
    const f = fixture(t, bestLawyersNotice(id), `https://${host}/`);
    let rejects = 0, other = 0;
    f.doc.querySelectorAll('#acceptAllCookies, #close').forEach((button) => { button.onclick = () => other++; });
    f.doc.getElementById(id).onclick = () => {
      rejects++;
      f.doc.cookie = 'bl_cookie_policy_V4=0; path=/';
      f.doc.querySelector('.cookie-notice').hidden = true;
    };
    f.start();
    await waitFor(() => f.events.length === 1);
    assert.equal(rejects, 1);
    assert.equal(other, 0);
    assert.equal(f.doc.cookie, 'bl_cookie_policy_V4=0');
    assert.equal(f.events[0].platform, 'Best Lawyers');
    await sleep(150);
    assert.equal(f.events.length, 1);
  });
}
test('Best Lawyers adapter fails closed for host, scope, selector, label and actionability drift', async (t) => {
  const cases = [
    ['unrelated host', 'https://example.test/', (f) => {}],
    ['subdomain', 'https://news.bestlawyers.com/', (f) => {}],
    ['suffix host', 'https://www.bestlawyers.com.example.test/', (f) => {}],
    ['wrong cookie name', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('.cookie-notice').dataset.cookieName = 'bl_cookie_policy_V5'; }],
    ['missing scope', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('.cookie-notice').className = ''; }],
    ['wrong ID', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').id = 'onlyEssentialCookie'; }],
    ['generic refusal fallback', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').textContent = 'Reject all'; }],
    ['accept label', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').textContent = 'Accept All Cookies'; }],
    ['close label', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').textContent = 'Close'; }],
    ['conflicting accessible label', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').setAttribute('aria-label', 'Accept All Cookies'); }],
    ['hidden control', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').hidden = true; }],
    ['disabled control', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').disabled = true; }],
    ['aria-disabled control', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('button').setAttribute('aria-disabled', 'true'); }],
    ['hidden notice', 'https://www.bestlawyers.com/', (f) => { f.doc.querySelector('.cookie-notice').hidden = true; }]
  ];
  for (const [name, url, prepare] of cases) {
    const f = fixture(t, bestLawyersNotice('onlyEssentialCookies', 'role="dialog"'), url);
    prepare(f);
    let clicks = 0;
    f.doc.addEventListener('click', () => clicks++);
    f.start();
    await sleep(110);
    f.disable();
    assert.equal(clicks, 0, name);
    assert.equal(f.events.length, 0, name);
  }
  const f = fixture(t, '<div role="dialog"><h2>Cookie consent</h2><button>Reject all</button></div>', 'https://www.bestlawyers.com/');
  let clicks = 0;
  f.doc.querySelector('button').onclick = () => clicks++;
  f.start();
  await sleep(150);
  assert.equal(clicks, 0, 'missing adapter scope must not enable a generic dialog');
});
test('Best Lawyers disappearance alone, duplicate cookies and cookie zero alone cannot count', async (t) => {
  await Promise.all([
    ['missing cookie', '', true], ['accept cookie', 'bl_cookie_policy_V4=1', true],
    ['ambiguous duplicate', 'bl_cookie_policy_V4=0; bl_cookie_policy_V4=1', true],
    ['duplicate zero', 'bl_cookie_policy_V4=0; bl_cookie_policy_V4=0', true],
    ['encoded value', 'bl_cookie_policy_V4=%30', true],
    ['ambiguous spaced duplicate', 'bl_cookie_policy_V4=0; bl_cookie_policy_V4 =1', true],
    ['zero while visible', 'bl_cookie_policy_V4=0', false]
  ].map(async ([name, cookie, hide]) => {
    const f = fixture(t, bestLawyersNotice(), 'https://bestlawyers.com/');
    let writes = 0, clicks = 0;
    Object.defineProperty(f.doc, 'cookie', { get: () => cookie, set: () => { writes++; } });
    f.doc.querySelector('button').onclick = () => { clicks++; if (hide) f.doc.querySelector('.cookie-notice').hidden = true; };
    f.start();
    await sleep(2500);
    f.disable();
    assert.ok(clicks >= 1 && clicks <= 3, name);
    assert.equal(writes, 0, name);
    assert.equal(f.events.length, 0, name);
  }));
});
test('Best Lawyers malformed replacement notice still blocks completion', async (t) => {
  const f = fixture(t, bestLawyersNotice(), 'https://bestlawyers.com/');
  f.doc.querySelector('button').onclick = () => {
    f.doc.cookie = 'bl_cookie_policy_V4=0';
    f.doc.querySelector('.cookie-notice').remove();
    f.doc.body.innerHTML = '<div class="cookie-notice" data-cookie-name="unknown"><cookie-options></cookie-options></div>';
  };
  f.start();
  await sleep(2500);
  assert.equal(f.events.length, 0);
});
test('Best Lawyers observes generic and other CMP replacements without authorising their actions', async (t) => {
  await Promise.all([
    ['generic', '<div role="dialog"><h2>Cookie preferences</h2><label>Analytics<input type="checkbox" checked></label><button>Reject all</button></div>'],
    ['Cookiebot', cookiePanel()],
    ['OneTrust', '<div id="onetrust-pc-sdk"><h2>Cookie preferences</h2><input type="checkbox" checked><button id="onetrust-reject-all-handler">Reject all</button></div>']
  ].map(async ([name, replacement]) => {
    const f = fixture(t, bestLawyersNotice(), 'https://www.bestlawyers.com/');
    let clicks = 0;
    f.doc.addEventListener('click', () => clicks++);
    f.doc.getElementById('onlyEssentialCookies').onclick = () => {
      f.doc.cookie = 'bl_cookie_policy_V4=0';
      f.doc.querySelector('.cookie-notice').remove();
      f.doc.body.innerHTML = replacement;
    };
    f.start();
    await sleep(2500);
    f.disable();
    assert.equal(f.doc.cookie, 'bl_cookie_policy_V4=0', name);
    assert.equal(clicks, 1, name);
    assert.ok(Array.from(f.doc.querySelectorAll('input')).every((input) => input.checked), name);
    assert.equal(f.events.length, 0, name);
  }));
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
test('Manage cookies and Save preferences remain supported with a complete inventory', async (t) => {
  const f = fixture(t, '<div id="CybotCookiebotDialog">Cookie consent<button id="CybotCookiebotDialogBodyButtonDetails">Manage cookies</button></div>');
  let opens = 0, saves = 0;
  f.doc.querySelector('button').onclick = () => {
    opens++;
    f.doc.getElementById('CybotCookiebotDialog').innerHTML = cookieControls() + '<button id="CybotCookiebotDialogBodyLevelButtonAccept">Save preferences</button>';
    f.doc.querySelector('button').onclick = () => {
      assert.ok(Array.from(f.doc.querySelectorAll('input:not(:disabled)')).every((input) => !input.checked));
      saves++;
      f.doc.getElementById('CybotCookiebotDialog').remove();
    };
  };
  f.start();
  await waitFor(() => f.events.length === 1);
  assert.equal(opens, 1);
  assert.equal(saves, 1);
});
test('known manage and save selectors require positive wording with no accessible conflict', async (t) => {
  const labels = ['', 'Continue', 'Close', 'Withdraw consent', 'OK', 'Subscribe', 'Pay to continue',
    'Accepter et continuer', 'Accept all'];
  for (const action of ['manage', 'save']) {
    for (const text of [...labels, 'conflicting accessible name', 'conflicting visible name']) {
      const isConflict = text.startsWith('conflicting');
      const markup = action === 'manage'
        ? '<div id="CybotCookiebotDialog">Cookie consent<button id="CybotCookiebotDialogBodyButtonDetails">Manage cookies</button></div>'
        : cookiePanel();
      const f = fixture(t, markup);
      const button = f.doc.querySelector('button');
      if (text === 'conflicting accessible name') button.setAttribute('aria-label', 'Accept all');
      else if (text === 'conflicting visible name') {
        button.setAttribute('aria-label', button.textContent);
        button.textContent = 'Accept all';
      } else button.textContent = text;
      let clicks = 0;
      f.doc.addEventListener('click', () => clicks++);
      f.start();
      await sleep(110);
      f.disable();
      assert.equal(clicks, 0, `${action}: ${isConflict ? text : text || '(blank)'}`);
      assert.equal(f.events.length, 0);
      assert.ok(Array.from(f.doc.querySelectorAll('input')).every((input) => input.checked));
    }
  }
});
test('save wording is revalidated when it changes during optional-off clicks', async (t) => {
  const f = fixture(t, cookiePanel());
  f.doc.querySelector('input:not(:disabled)').onclick = () => { f.doc.querySelector('button').textContent = 'Continue'; };
  let saves = 0;
  f.doc.querySelector('button').onclick = () => saves++;
  f.start();
  await sleep(500);
  assert.equal(saves, 0);
  assert.equal(f.events.length, 0);
  assert.ok(f.doc.querySelectorAll('input:checked').length > 1);
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
test('opaque replacement consent surfaces cannot be mistaken for an empty mount', async (t) => {
  await Promise.all([
    ['observable shadow host', (f, root) => { root.appendChild(f.doc.createElement('div')).attachShadow({ mode: 'open' }); }],
    ['shadow root on mount', (f, root) => { root.attachShadow({ mode: 'open' }); }],
    ['custom element', (f, root) => { root.appendChild(f.doc.createElement('cookie-options')); }],
    ['closed custom element', (f, root) => { root.appendChild(f.doc.createElement('cookie-options')).attachShadow({ mode: 'closed' }); }],
    ['customised built-in', (f, root) => { root.innerHTML = '<div is="cookie-options"></div>'; }],
    ['declarative shadow template', (f, root) => { root.innerHTML = '<template shadowrootmode="closed"><button>Accept all</button></template>'; }]
  ].map(async ([name, replace]) => {
    const f = fixture(t, '<div class="qc-cmp2-container"><div class="qc-cmp2-ui">Cookie consent<button>Reject all</button></div></div>');
    let clicks = 0;
    f.doc.querySelector('button').onclick = () => {
      clicks++;
      const root = f.doc.querySelector('.qc-cmp2-container');
      root.replaceChildren();
      replace(f, root);
    };
    f.start();
    await sleep(2500);
    f.disable();
    assert.equal(clicks, 1, name);
    assert.equal(f.events.length, 0, name);
  }));
});
test('a shadow-only missing refusal target is never traversed or counted', async (t) => {
  for (const scope of ['id="cmpwrapper"', 'id="onetrust-banner-sdk"']) {
    const f = fixture(t, `<div ${scope}></div>`);
    const shadow = f.doc.querySelector('div').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button id="onetrust-reject-all-handler">Zustimmung widerrufen</button><button>Reject all</button>';
    let clicks = 0;
    shadow.querySelectorAll('button').forEach((button) => { button.onclick = () => clicks++; });
    f.start();
    await sleep(350);
    f.disable();
    assert.equal(clicks, 0);
    assert.equal(f.events.length, 0);
  }
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
