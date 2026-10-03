(function (global) {
  'use strict';
  const api = global.browser || global.chrome;
  if (!api?.storage?.local || !global.QuietExitEngine) return;
  let enabled = false;
  let revision = 0;
  let suspended = false;
  // Retry only reporting, with the original ID for background deduplication.
  // Bound both memory and lifetime; navigation/off deliberately cancels delivery.
  const deliveries = new Map();
  const MAX_DELIVERIES = 32;
  const MAX_ATTEMPTS = 3;
  const ACK_TIMEOUT = 2000;

  function finishDelivery(delivery) {
    global.clearTimeout(delivery.timer);
    deliveries.delete(delivery.message.eventId);
  }
  function cancelDeliveries() {
    for (const delivery of deliveries.values()) finishDelivery(delivery);
  }
  function sendDelivery(delivery) {
    if (!enabled || deliveries.get(delivery.message.eventId) !== delivery) return;
    delivery.attempts += 1;
    let settled = false;
    function complete(reply) {
      if (settled || deliveries.get(delivery.message.eventId) !== delivery) return;
      settled = true;
      global.clearTimeout(delivery.timer);
      if (reply?.ok === true || !enabled || delivery.attempts >= MAX_ATTEMPTS) {
        finishDelivery(delivery);
      } else {
        delivery.timer = global.setTimeout(() => sendDelivery(delivery), 250 * delivery.attempts);
      }
    }
    delivery.timer = global.setTimeout(() => complete(), ACK_TIMEOUT);
    try {
      Promise.resolve(api.runtime.sendMessage(delivery.message)).then(complete, () => complete());
    } catch { complete(); }
  }
  function deliverDenied({ eventId, platform }) {
    if (!enabled || deliveries.has(eventId) || deliveries.size >= MAX_DELIVERIES) return;
    const delivery = { message: { type: 'banner-denied', eventId, platform }, attempts: 0, timer: null };
    deliveries.set(eventId, delivery);
    sendDelivery(delivery);
  }
  function apply(value) {
    enabled = !suspended && value !== false;
    if (!enabled) cancelDeliveries();
    global.QuietExitEngine.stop();
    if (enabled) global.QuietExitEngine.start({
      isEnabled: () => enabled,
      onDenied: deliverDenied
    });
  }
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, 'enabled')) return;
    revision += 1;
    apply(changes.enabled.newValue);
  });
  // Promise form is supported by Firefox and the required MV3 Chrome versions.
  // Read errors fail closed; missing preference uses the documented enabled default.
  function loadPreference() {
    const initialRevision = revision;
    try {
      Promise.resolve(api.storage.local.get('enabled')).then((stored) => {
        if (revision === initialRevision && !suspended) apply(stored?.enabled);
      }).catch(() => {});
    } catch { /* Fail closed when extension storage is unavailable. */ }
  }
  loadPreference();
  global.addEventListener('pagehide', () => {
    revision += 1;
    suspended = true;
    enabled = false;
    cancelDeliveries();
    global.QuietExitEngine.stop();
  });
  global.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    revision += 1;
    suspended = false;
    loadPreference();
  });
})(globalThis);
