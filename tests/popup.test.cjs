const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('extension/popup/popup.html', 'utf8');
const source = fs.readFileSync('extension/popup/popup.js', 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

function open(data = {}, { promises = false, failGet = false, failSet = false } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const changes = [];
  const writes = [];
  const api = { runtime: {}, storage: { local: {}, onChanged: { addListener(fn) { changes.push(fn); } } } };
  const operation = async (method, argument) => {
    if (method === 'get' && failGet || method === 'set' && failSet) throw new Error('Storage unavailable');
    if (method === 'get') return { ...data };
    writes.push({ ...argument });
    Object.assign(data, argument);
  };
  for (const method of ['get', 'set']) {
    api.storage.local[method] = promises ? arg => operation(method, arg) : (arg, callback) => {
      operation(method, arg).then(callback, error => {
        api.runtime.lastError = error;
        callback();
        delete api.runtime.lastError;
      });
    };
  }
  dom.window[promises ? 'browser' : 'chrome'] = api;
  dom.window.eval(source);
  const query = selector => dom.window.document.querySelector(selector);
  return { dom, query, writes, changes, data };
}

for (const promises of [false, true]) {
  test(`${promises ? 'browser' : 'chrome'} popup loads defaults and persists preference`, async () => {
    const popup = open({}, { promises });
    assert.equal(popup.query('#enabled').disabled, true);
    await settle();
    assert.equal(popup.query('#enabled').checked, true);
    assert.equal(popup.query('#enabled').disabled, false);
    assert.equal(popup.query('#denied-count').textContent, '0');
    popup.query('#enabled').checked = false;
    popup.query('#enabled').dispatchEvent(new popup.dom.window.Event('change'));
    await settle();
    assert.deepEqual(popup.writes, [{ enabled: false }]);
    assert.equal(popup.query('#enabled-state').textContent, 'Paused');
    assert.equal(popup.query('#popup').getAttribute('aria-busy'), 'false');
    popup.dom.window.close();
  });
}

test('live local storage changes update counter and switch', async () => {
  const popup = open({ enabled: false, deniedCount: 14 });
  await settle();
  popup.changes[0]({ enabled: { newValue: true }, deniedCount: { newValue: 1234 } }, 'local');
  assert.equal(popup.query('#enabled').checked, true);
  assert.equal(popup.query('#denied-count').textContent, '1,234');
  popup.changes[0]({ enabled: { newValue: false } }, 'sync');
  assert.equal(popup.query('#enabled').checked, true);
  popup.dom.window.close();
});

test('failed preference write restores saved switch and reports accessible error', async () => {
  const popup = open({ enabled: true }, { failSet: true });
  await settle();
  popup.query('#enabled').checked = false;
  popup.query('#enabled').dispatchEvent(new popup.dom.window.Event('change'));
  await settle();
  assert.equal(popup.query('#enabled').checked, true);
  assert.equal(popup.query('#enabled').disabled, false);
  assert.equal(popup.query('#status').dataset.error, 'true');
  assert.equal(popup.query('#status').getAttribute('role'), 'status');
  assert.equal(popup.query('#retry').hidden, false);
  popup.dom.window.close();
});

test('failed initial load leaves preference disabled with retry', async () => {
  const popup = open({}, { failGet: true, promises: true });
  await settle();
  assert.equal(popup.query('#enabled').disabled, true);
  assert.equal(popup.query('#enabled-state').textContent, 'Preference unavailable');
  assert.equal(popup.query('#retry').hidden, false);
  assert.equal(popup.query('#popup').getAttribute('aria-busy'), 'false');
  popup.dom.window.close();
});
