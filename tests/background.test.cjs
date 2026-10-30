const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('extension/background.js', 'utf8');

function start(data = {}, promiseAPI = false, failing = false) {
  let listener;
  const api = { runtime: { id: 'test-extension', onMessage: { addListener(fn) { listener = fn; } } }, storage: { local: {} } };
  const perform = async (method, argument) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3));
    if (failing) throw new Error('Storage unavailable');
    if (method === 'get') return Object.fromEntries(argument.filter(key => key in data).map(key => [key, structuredClone(data[key])]));
    Object.assign(data, structuredClone(argument));
  };
  for (const method of ['get', 'set']) {
    api.storage.local[method] = promiseAPI ? arg => perform(method, arg) : (arg, callback) => {
      perform(method, arg).then(callback, error => {
        api.runtime.lastError = error;
        callback();
        delete api.runtime.lastError;
      });
    };
  }
  vm.runInNewContext(source, { [promiseAPI ? 'browser' : 'chrome']: api });
  return {
    data,
    send(message, sender = { id: 'test-extension', tab: { id: 1 } }) {
      return new Promise(resolve => {
        const accepted = listener(message, sender, resolve);
        if (!accepted) resolve({ ignored: true });
      });
    }
  };
}
const event = eventId => ({ type: 'banner-denied', eventId, platform: 'onetrust' });

test('generic consent dialog names count with the engine message contract', async () => {
  const worker = start();
  const reply = await worker.send({ ...event('generic-dialog'), platform: 'Cookie dialog' });
  assert.equal(reply.ok, true);
  assert.equal(worker.data.deniedCount, 1);
});

for (const promises of [false, true]) {
  test(`${promises ? 'browser' : 'chrome'}: simultaneous events increment once and defaults apply`, async () => {
    const worker = start({}, promises);
    const replies = await Promise.all(Array.from({ length: 40 }, (_, i) => worker.send(event(`event-${i % 20}`))));
    assert.equal(worker.data.deniedCount, 20);
    assert.equal(worker.data.enabled, true);
    assert.equal(replies.filter(reply => reply.duplicate).length, 20);
    assert.deepEqual(Object.keys(worker.data).sort(), ['deniedCount', 'deniedEventIds', 'enabled']);
  });
  test(`${promises ? 'browser' : 'chrome'}: dedupe survives restart and preserves preferences`, async () => {
    const data = { enabled: false, deniedCount: 8 };
    await start(data, promises).send(event('unique'));
    const reply = await start(data, promises).send(event('unique'));
    assert.equal(reply.duplicate, true);
    assert.equal(data.deniedCount, 9);
    assert.equal(data.enabled, false);
  });
  test(`${promises ? 'browser' : 'chrome'}: storage failures respond without hanging`, async () => {
    const reply = await start({}, promises, true).send(event('unique'));
    assert.equal(reply.ok, false);
  });
}

test('ignores invalid data and non-content senders', async () => {
  const worker = start();
  for (const message of [null, {}, event(''), event('x'.repeat(161)), event('has\ncontrol'), event('https://visited.example/page'), { ...event('ok'), platform: 'https://example.com' }]) {
    assert.deepEqual(await worker.send(message), { ignored: true });
  }
  for (const sender of [{}, { id: 'test-extension' }, { id: 'other', tab: { id: 1 } }, { id: 'test-extension', tab: {} }, { id: 'test-extension', tab: { id: -1 } }]) {
    assert.deepEqual(await worker.send(event('ok'), sender), { ignored: true });
  }
  await worker.send(event('valid'));
  assert.equal(worker.data.deniedCount, 1);
});

test('retains only bounded event history and normalises corrupt counts', async () => {
  const data = { deniedCount: -4 };
  const worker = start(data, true);
  for (let i = 0; i < 258; i++) await worker.send(event(`event-${i}`));
  assert.equal(data.deniedCount, 258);
  assert.equal(data.deniedEventIds.length, 256);
  assert.equal(data.deniedEventIds[0], 'event-2');
});
