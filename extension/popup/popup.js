(() => {
  'use strict';
  const usesPromises = typeof browser !== 'undefined';
  const api = usesPromises ? browser : chrome;
  const root = document.querySelector('#popup');
  const toggle = document.querySelector('#enabled');
  const state = document.querySelector('#enabled-state');
  const counter = document.querySelector('#denied-count');
  const status = document.querySelector('#status');
  const retry = document.querySelector('#retry');
  let savedEnabled = true;
  let writing = false;

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

  function renderEnabled(value) {
    savedEnabled = typeof value === 'boolean' ? value : true;
    toggle.checked = savedEnabled;
    state.textContent = savedEnabled ? 'Enabled' : 'Paused';
    state.dataset.enabled = String(savedEnabled);
  }

  function renderCount(value) {
    counter.textContent = (Number.isSafeInteger(value) && value >= 0 ? value : 0).toLocaleString('en-AU');
  }

  function showStatus(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
    retry.hidden = !error;
  }

  async function load() {
    root.setAttribute('aria-busy', 'true');
    toggle.disabled = true;
    retry.hidden = true;
    showStatus('Loading local settings…');
    try {
      const saved = await storage('get', ['enabled', 'deniedCount']);
      renderEnabled(saved.enabled);
      renderCount(saved.deniedCount);
      toggle.disabled = false;
      showStatus('Settings and count stay on this device.');
    } catch {
      state.textContent = 'Preference unavailable';
      showStatus('Could not load local settings. Try again.', true);
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }

  toggle.addEventListener('change', async () => {
    const next = toggle.checked;
    const previous = savedEnabled;
    writing = true;
    toggle.disabled = true;
    root.setAttribute('aria-busy', 'true');
    showStatus('Saving preference…');
    try {
      await storage('set', { enabled: next });
      renderEnabled(next);
      showStatus(next ? 'Automatic decline enabled.' : 'Automatic decline paused.');
    } catch {
      renderEnabled(previous);
      showStatus('Could not save your preference. Try again.', true);
    } finally {
      writing = false;
      toggle.disabled = false;
      root.setAttribute('aria-busy', 'false');
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled && !writing) renderEnabled(changes.enabled.newValue);
    if (changes.deniedCount) renderCount(changes.deniedCount.newValue);
  });
  retry.addEventListener('click', load);
  load();
})();
