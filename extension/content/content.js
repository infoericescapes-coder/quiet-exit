(function (global) {
  'use strict';
  const api = global.browser || global.chrome;
  if (!api?.storage?.local || !global.QuietExitEngine) return;
  let enabled = false;
  let revision = 0;
  let suspended = false;
  function apply(value) {
    enabled = !suspended && value !== false;
    global.QuietExitEngine.stop();
    if (enabled) global.QuietExitEngine.start({
      isEnabled: () => enabled,
      onDenied: ({ eventId, platform }) => {
        if (!enabled) return;
        try {
          const pending = api.runtime.sendMessage({ type: 'banner-denied', eventId, platform });
          pending?.catch?.(() => {});
        } catch { /* The extension may have reloaded while this frame was open. */ }
      }
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
    global.QuietExitEngine.stop();
  });
  global.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    revision += 1;
    suspended = false;
    loadPreference();
  });
})(globalThis);
