const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('extension/content/content.js', 'utf8');
const background = fs.readFileSync('extension/background.js', 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

async function start(send) {
  let onChanged, engine, starts = 0, stops = 0, clock = 0, nextId = 0;
  const timers = new Map(), events = new Map(), messages = [];
  const stored = { enabled: true };
  vm.runInNewContext(source, {
    browser: {
      runtime: { sendMessage(message) { messages.push({ ...message }); return send(message, messages.length); } },
      storage: {
        local: { get: async () => ({ ...stored }) },
        onChanged: { addListener(fn) { onChanged = fn; } }
      }
    },
    QuietExitEngine: {
      start(options) { starts++; engine = options; },
      stop() { stops++; }
    },
    addEventListener(name, fn) { events.set(name, fn); },
    setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  await flush();
  return {
    messages, timers, stored,
    get starts() { return starts; }, get stops() { return stops; },
    deny(eventId = 'stable-event') { engine.onDenied({ eventId, platform: 'OneTrust' }); },
    async toggle(value) {
      stored.enabled = value;
      onChanged({ enabled: { newValue: value } }, 'local');
      await flush();
    },
    async event(name, persisted = false) { events.get(name)({ persisted }); await flush(); },
    async nextTimer() {
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0] || [];
      assert.ok(timer, 'expected a pending delivery timer');
      clock = timer.at;
      timers.delete(id);
      timer.fn();
      await flush();
    }
  };
}

for (const failure of ['rejection', 'negative acknowledgement', 'synchronous exception', 'missing acknowledgement']) {
  test(`retries ${failure} with the same event without restarting consent work`, async () => {
    const f = await start((message, attempt) => {
      if (attempt > 1) return Promise.resolve({ ok: true });
      if (failure === 'rejection') return Promise.reject(new Error('disconnected'));
      if (failure === 'synchronous exception') throw new Error('reloaded');
      return Promise.resolve(failure === 'negative acknowledgement' ? { ok: false } : undefined);
    });
    f.deny();
    await flush();
    await f.nextTimer();
    assert.equal(f.messages.length, 2);
    assert.deepEqual(f.messages[0], f.messages[1]);
    assert.equal(f.starts, 1);
    assert.equal(f.timers.size, 0);
  });
}

test('a dropped acknowledgement retries against real background dedupe and counts once', async () => {
  const data = {};
  let listener;
  vm.runInNewContext(background, { browser: {
    runtime: { id: 'extension', onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: {
      get: async keys => Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]])),
      set: async values => { Object.assign(data, values); }
    } }
  } });
  const replies = [];
  const f = await start((message, attempt) => new Promise(resolve => {
    listener(message, { id: 'extension', tab: { id: 1 } }, reply => {
      replies.push(reply);
      if (attempt > 1) resolve(reply);
    });
  }));
  f.deny();
  await flush();
  assert.equal(data.deniedCount, 1);
  await f.nextTimer(); // Missing first response times out.
  await f.nextTimer(); // Retry the original event ID.
  assert.equal(f.messages.length, 2);
  assert.deepEqual(f.messages[0], f.messages[1]);
  assert.equal(data.deniedCount, 1);
  assert.equal(replies[1].duplicate, true);
  assert.equal(f.timers.size, 0);
});

test('never-resolving delivery stops after three attempts', async () => {
  const f = await start(() => new Promise(() => {}));
  f.deny();
  for (let i = 0; i < 5; i++) await f.nextTimer();
  assert.equal(f.messages.length, 3);
  assert.equal(f.timers.size, 0);
  assert.equal(f.starts, 1);
});

test('pending deliveries and repeated notifications are bounded', async () => {
  const f = await start(() => new Promise(() => {}));
  f.deny('event-0');
  f.deny('event-0');
  for (let i = 1; i < 40; i++) f.deny(`event-${i}`);
  assert.equal(f.messages.length, 32);
  assert.equal(f.timers.size, 32);
  await f.toggle(false);
  assert.equal(f.timers.size, 0);
});

for (const teardown of ['disable', 'pagehide']) {
  test(`${teardown} cancels retries and ignores a late failed acknowledgement`, async () => {
    let resolve;
    const f = await start(() => new Promise(done => { resolve = done; }));
    f.deny();
    if (teardown === 'disable') await f.toggle(false);
    else await f.event('pagehide', true);
    assert.equal(f.timers.size, 0);
    resolve({ ok: false });
    await flush();
    f.deny('after-teardown');
    assert.equal(f.messages.length, 1);
    assert.equal(f.timers.size, 0);
  });
}

test('disable cancels an already scheduled retry', async () => {
  const f = await start(() => Promise.resolve({ ok: false }));
  f.deny();
  await flush();
  assert.equal(f.timers.size, 1);
  await f.toggle(false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.messages.length, 1);
});

test('bfcache restore rereads preferences and starts fresh without reviving canceled deliveries', async () => {
  const f = await start(() => new Promise(() => {}));
  f.deny();
  await f.event('pagehide', true);
  f.stored.enabled = false;
  await f.event('pageshow', true);
  assert.equal(f.starts, 1);
  assert.equal(f.timers.size, 0);
  await f.toggle(true);
  assert.equal(f.starts, 2);
  f.deny('new-event');
  assert.equal(f.messages.length, 2);
  assert.equal(f.messages[1].eventId, 'new-event');
  await f.event('pagehide', true);
  await f.event('pageshow', true);
  assert.equal(f.starts, 3);
  assert.equal(f.messages.length, 2);
  assert.equal(f.timers.size, 0);
});
