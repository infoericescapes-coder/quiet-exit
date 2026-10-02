/* Local aggregate counts only. No page URLs, domains or telemetry are retained. */
(() => {
  'use strict';
  const usesPromises = typeof browser !== 'undefined';
  const api = usesPromises ? browser : chrome;
  const HISTORY_KEY = 'deniedEventIds';
  const HISTORY_LIMIT = 256;
  let pending = Promise.resolve();

  function storage(method, value) {
    if (usesPromises) return Promise.resolve(api.storage.local[method](value));
    return new Promise((resolve, reject) => {
      api.storage.local[method](value, result => {
        const error = api.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  function serialise(work) {
    const result = pending.then(work);
    pending = result.catch(() => {});
    return result;
  }

  function validText(value, limit) {
    return typeof value === 'string' && value.length > 0 && value.length <= limit &&
      /^[a-zA-Z0-9_-]+$/.test(value);
  }

  function validMessage(message, sender) {
    return Boolean(sender && sender.tab && Number.isInteger(sender.tab.id) && sender.tab.id >= 0 &&
      (!api.runtime.id || sender.id === api.runtime.id) && message &&
      message.type === 'banner-denied' && validText(message.eventId, 160) &&
      typeof message.platform === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,63}$/.test(message.platform));
  }

  function count(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  serialise(async () => {
    const saved = await storage('get', ['enabled', 'deniedCount']);
    const defaults = {};
    if (typeof saved.enabled !== 'boolean') defaults.enabled = true;
    if (saved.deniedCount !== count(saved.deniedCount)) defaults.deniedCount = 0;
    if (Object.keys(defaults).length) await storage('set', defaults);
  }).catch(() => {});

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (!validMessage(message, sender)) return false;
    serialise(async () => {
      const saved = await storage('get', ['deniedCount', HISTORY_KEY]);
      const recent = Array.isArray(saved[HISTORY_KEY])
        ? saved[HISTORY_KEY].filter(id => validText(id, 160)).slice(-HISTORY_LIMIT) : [];
      if (recent.includes(message.eventId)) {
        return { ok: true, duplicate: true, deniedCount: count(saved.deniedCount) };
      }
      const deniedCount = Math.min(Number.MAX_SAFE_INTEGER, count(saved.deniedCount) + 1);
      await storage('set', {
        deniedCount,
        [HISTORY_KEY]: [...recent, message.eventId].slice(-HISTORY_LIMIT)
      });
      return { ok: true, deniedCount };
    }).then(respond, () => respond({ ok: false, error: 'Could not save the local count.' }));
    return true; // Keep the response channel open in classic scripts and MV3 workers.
  });
})();
