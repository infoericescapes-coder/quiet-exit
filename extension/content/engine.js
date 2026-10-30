/* No page-context SDK calls: deliberate UI clicks and conservative DOM verification only. */
(function (global) {
  'use strict';
  const doc = global.document;
  const BUTTONS = 'button, a, input[type="button"], input[type="submit"], [role="button"]';
  const NATIVE_ACTIONS = 'button, a, input[type="button"], input[type="submit"]';
  const CONTROLS = 'input:not([type="hidden"]), select, textarea, [role="switch"], [role="checkbox"], [aria-pressed], [aria-checked]';
  const REJECT = new Set(['reject', 'reject all', 'reject all cookies', 'deny', 'deny all', 'deny all cookies',
    'decline', 'decline all', 'decline all cookies', 'only necessary', 'necessary only', 'essential only',
    'only essential cookies', 'only necessary cookies', 'use only necessary cookies', 'essential cookies only',
    'reject optional cookies', 'reject non-essential cookies', 'continue without accepting']);
  const MANAGE = new Set(['manage cookies', 'manage preferences', 'manage cookie preferences', 'cookie settings', 'cookie preferences', 'customize', 'customise', 'settings']);
  const SAVE = new Set(['allow selection', 'accept selection', 'accept selected', 'save selection',
    'save preferences', 'save my preferences', 'save settings', 'confirm my choices', 'confirm choices']);
  const REQUIRED = /^(strictly necessary|necessary|essential)( cookies)?$/;
  const LIMIT = 60;
  const MAX_ATTEMPTS = 3;
  const WAIT_MS = 2200;
  const SETTLE_MS = 180;
  let session = null;
  const instances = new WeakMap();
  const completed = new WeakSet();
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  function noGeneratedWording(element) {
    try {
      for (const pseudo of ['::before', '::after']) {
        const content = global.getComputedStyle(element, pseudo)?.content;
        if (typeof content !== 'string' || !['none', 'normal', '""', "''"].includes(content.trim())) return false;
      }
      return true;
    } catch { return false; }
  }
  function label(element) {
    const refs = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    if (element.hasAttribute('aria-label')) return normalize(element.getAttribute('aria-label'));
    if (refs.length) return normalize(refs.map((id) => doc.getElementById(id)?.textContent || '').join(' '));
    return normalize(element.value && element.tagName === 'INPUT' ? element.value : element.textContent);
  }
  function actionWording(element, allowed) {
    // Selectors identify candidates, never their current meaning. Require positive
    // visible wording and validate every supplied accessible name independently.
    // Native role hosts and native descendants such as span/div may conceal an
    // unobservable closed root. Only plain native controls are inspectable here.
    // Reject external names rather than approximate the accessibility algorithm.
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      !element.matches(NATIVE_ACTIONS) || element.children.length || opaqueSurface(element) ||
      element.hasAttribute('aria-labelledby') || element.labels?.length || !noGeneratedWording(element)) return false;
    // No descendants means hidden text cannot be silently removed from the name.
    const wording = [normalize(element.tagName === 'INPUT' ? element.value : element.textContent)];
    if (element.hasAttribute('aria-label')) wording.push(normalize(element.getAttribute('aria-label')));
    return wording.every((text) => allowed.has(text));
  }
  function visible(element, geometry = true) {
    if (!element?.isConnected) return false;
    for (let node = element; node?.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false;
      if (node.tagName === 'DIALOG' && !node.open) return false;
      if (node.tagName === 'DETAILS' && !node.open && !node.querySelector('summary')?.contains(element)) return false;
      const style = global.getComputedStyle(node);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || style.opacity === '0') return false;
    }
    // Layout is checked when the document has a layout engine. DOM-only test hosts
    // fall back to semantic/CSS visibility, rather than changing production selectors.
    if (geometry && doc.documentElement.getClientRects().length && !Array.from(element.getClientRects()).some((r) => r.width > 0 && r.height > 0)) return false;
    return true;
  }
  const disabled = (element) => element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
  const actionable = (element) => visible(element) && !disabled(element);
  function active(run) {
    try { return session === run && !run.stopped && run.isEnabled() !== false && run.actions < LIMIT; }
    catch { return false; }
  }
  function click(run, element) {
    if (!active(run) || !actionable(element)) return false;
    run.actions += 1;
    element.click();
    return true;
  }
  const pause = (run, ms = 50) => new Promise((resolve) => {
    const timer = global.setTimeout(() => { run.waits.delete(timer); resolve(); }, ms);
    run.waits.set(timer, resolve);
  });
  async function until(run, predicate, timeout = WAIT_MS) {
    const deadline = Date.now() + timeout;
    while (active(run) && Date.now() < deadline) {
      const result = predicate();
      if (result) return result;
      await pause(run);
    }
    return null;
  }
  function genericScope(root) {
    const text = normalize(root.textContent);
    if (!/\bcookies?\b/.test(text) || !/consent|privacy|tracking|personal data|use cookies|cookie settings|cookie preferences/.test(text)) return false;
    // Privacy boilerplate occurs in invitation, account and checkout dialogs.
    // Require the dialog's primary purpose to be cookie consent, rather than
    // treating any mention of cookies as authority to press a bare "Reject".
    const heading = root.querySelector('h1, h2, h3, [role="heading"]');
    const titled = root.hasAttribute('aria-label') || root.hasAttribute('aria-labelledby');
    const purpose = titled ? label(root) : heading ? normalize(heading.textContent) : text;
    return /^(we use cookies|this (website|site) uses cookies|cookie consent|cookie preferences|cookie settings|cookies? and (privacy|consent)|manage cookie preferences|privacy preferences|your privacy choices|we value your privacy)\b/.test(purpose);
  }
  // Inspect host presence only. Never traverse roots whose choices we cannot inventory.
  const opaqueSurface = (root) => [root, ...all(root, '*')].some((node) => node.shadowRoot ||
    node.localName.includes('-') || node.hasAttribute('is') || node.matches('template[shadowrootmode]'));
  // An embedded or opaque consent surface is still an interface, even without DOM text.
  const hasContent = (root) => !!normalize(root.textContent) || opaqueSurface(root) ||
    !!root.querySelector(BUTTONS + ', ' + CONTROLS + ', iframe, embed, object, canvas, img, svg');
  function scopes(forObservation = false) {
    const found = [];
    const eligible = (global.QuietExitPlatforms || []).filter((platform) => !platform.hosts || platform.hosts.includes(global.location.hostname));
    const strict = eligible.filter((platform) => platform.strict);
    // Strict adapters restrict actions, while completion must still observe all
    // recognised consent surfaces, including generic or other CMP replacements.
    for (const platform of strict.length && !forObservation ? strict : eligible) {
      for (const root of all(doc, platform.scopes)) if (visible(root, false) && hasContent(root)) found.push({ root, platform });
    }
    for (const root of strict.length && !forObservation ? [] : all(doc, '[role="dialog"], [aria-modal="true"], dialog, [id*="cookie-consent"], [class~="cookie-consent"]')) {
      if (visible(root, false) && genericScope(root) && !found.some((item) => item.root.contains(root) || root.contains(item.root))) {
        found.push({ root, platform: { name: 'Cookie dialog', scopes: null } });
      }
    }
    // Nested CMP containers must not become separate banner instances.
    return found.filter((item) => !found.some((other) => other !== item && other.platform.name === item.platform.name && other.root.contains(item.root)));
  }
  function direct(root, platform) {
    const allowed = platform.rejectionText ? new Set([platform.rejectionText]) : REJECT;
    const candidates = all(root, BUTTONS).filter((button) => actionable(button) && actionWording(button, allowed));
    const known = platform.reject && candidates.find((button) => button.matches(platform.reject));
    return known || (platform.strict ? null : candidates[0]);
  }
  function manage(root, platform) {
    if (!platform.profile) return null;
    return all(root, BUTTONS).find((button) => actionable(button) &&
      actionWording(button, MANAGE));
  }
  function state(control) {
    if (control.matches('input[type="checkbox"]')) return control.indeterminate ? null : control.checked;
    if (control.matches('[role="switch"], [role="checkbox"]')) {
      const value = control.getAttribute('aria-checked');
      return value === 'true' ? true : value === 'false' ? false : null;
    }
    return null;
  }
  function controlTarget(control, panel) {
    if (visible(control)) return control;
    // Some CMPs style native checkboxes with display:none and render their label.
    // A hidden/collapsed parent never qualifies; only an associated visible label does.
    if (control.matches('input[type="checkbox"]') && !control.hidden && control.getAttribute('aria-hidden') !== 'true' && visible(control.parentElement, false)) {
      return Array.from(control.labels || []).find((node) => panel.contains(node) && visible(node)) || null;
    }
    return null;
  }
  function unsafePanel(panel) {
    if (!visible(panel, false)) return true;
    // Inventory only understands light DOM. Reject component hosts even without
    // an observable root: a closed root (or later upgrade) can conceal choices.
    if (opaqueSurface(panel)) return true;
    if (/legitimate interest|\bvendors?\b|third.party partners/i.test(panel.textContent)) return true;
    if (panel.querySelector('[aria-expanded="false"], details:not([open]), [role="tabpanel"][hidden], iframe, embed, object, canvas, template[shadowrootmode], [id*="vendor"], [class*="vendor"], [id*="legint"]')) return true;
    return all(panel, CONTROLS).some((control) => !control.matches('input[type="checkbox"], [role="switch"], [role="checkbox"]'));
  }
  function inventory(panel, profile) {
    if (unsafePanel(panel)) return null;
    const controls = all(panel, CONTROLS);
    const optional = [];
    const allowed = new Set();
    let save;
    if (profile === 'cookiebot') {
      const categories = ['Necessary', 'Preferences', 'Statistics', 'Marketing'];
      for (const category of categories) {
        const control = panel.querySelector('#CybotCookiebotDialogBodyLevelButton' + category);
        if (!control || !controls.includes(control) || state(control) === null || !controlTarget(control, panel)) return null;
        allowed.add(control);
        if (category !== 'Necessary') optional.push(control);
      }
      save = panel.querySelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection, #CybotCookiebotDialogBodyLevelButtonAccept');
    } else if (profile === 'onetrust') {
      const content = panel.querySelector('#ot-pc-content');
      const rows = content && all(content, '.ot-cat-grp');
      if (!rows?.length) return null;
      for (const row of rows) {
        if (!visible(row, false)) return null;
        const rowControls = all(row, CONTROLS);
        const heading = row.querySelector('.ot-cat-header, .ot-cat-item');
        const necessary = heading && REQUIRED.test(normalize(heading.textContent)) && !!row.querySelector('.ot-always-active');
        if (necessary && !rowControls.length) continue;
        if (rowControls.length !== 1 || !rowControls[0].matches('.ot-switch input[type="checkbox"], .ot-switch [role="switch"]')) return null;
        const control = rowControls[0];
        if (!control.id || state(control) === null || !controlTarget(control, panel)) return null;
        allowed.add(control);
        if (!necessary) optional.push(control);
      }
      save = panel.querySelector('.save-preference-btn-handler');
    } else if (profile === 'klaro') {
      // Only the flat, fully rendered service list is supported. Purpose grouping
      // may hide individual services, so it is intentionally excluded.
      const list = panel.querySelector('.cm-body > .cm-services');
      if (!list || panel.querySelector('.cm-purposes, .cm-opt-out')) return null;
      const rows = all(list, ':scope > .cm-service');
      if (!rows.length || rows.length !== list.children.length) return null;
      for (const row of rows) {
        if (!visible(row, false)) return null;
        const rowControls = all(row, CONTROLS);
        if (rowControls.length !== 1) return null;
        const control = rowControls[0];
        if (!control.matches('input.cm-list-input[type="checkbox"]') || !control.id.startsWith('service-item-') || state(control) === null || !controlTarget(control, panel)) return null;
        allowed.add(control);
        const required = control.classList.contains('required') && disabled(control) && !!row.querySelector('.cm-required');
        if (!required && !row.classList.contains('cm-toggle-all')) optional.push(control);
      }
      save = panel.querySelector('.cm-footer .cm-btn-accept:not(.cm-btn-accept-all)');
    } else return null;
    if (!optional.length || controls.some((control) => !allowed.has(control)) || !save || !actionable(save)) return null;
    // Selection wording is meaningful only after a complete optional-off inventory.
    if (!actionWording(save, SAVE)) return null;
    if (optional.some((control) => state(control) === null || disabled(control) || !controlTarget(control, panel))) return null;
    return { optional, save };
  }
  function panelFor(platform) {
    if (!platform.panel) return null;
    return all(doc, platform.panel).find((panel) => visible(panel, false)) || null;
  }
  function familyVisible(root, platform) {
    return (visible(root, false) && hasContent(root)) ||
      (platform.guardScopes && all(doc, platform.guardScopes).some((node) => visible(node, false) && hasContent(node))) ||
      scopes(!!platform.strict).some((item) => platform.strict || item.platform.name === platform.name);
  }
  function outcomeKnown(platform) {
    if (!platform.outcomeCookie) return true;
    // Read-only evidence: duplicates, missing values and any value other than the
    // retained site's exact essential-only marker cannot establish an outcome.
    const entries = doc.cookie.split(';').map((entry) => entry.trim()).filter((entry) =>
      entry.split('=')[0].trim() === platform.outcomeCookie);
    return entries.length === 1 && entries[0] === platform.outcomeCookie + '=0';
  }
  async function confirmed(run, root, platform) {
    let absentSince = null;
    return !!(await until(run, () => {
      if (familyVisible(root, platform) || !outcomeKnown(platform)) { absentSince = null; return false; }
      if (absentSince === null) absentSince = Date.now();
      return Date.now() - absentSince >= SETTLE_MS;
    }));
  }
  async function preferences(run, root, platform, record) {
    let panel = panelFor(platform);
    if (!panel || !inventory(panel, platform.profile)) {
      const opener = manage(root, platform);
      if (!opener || !click(run, opener)) return false;
      record.touched.add(root);
      panel = await until(run, () => {
        const candidate = panelFor(platform);
        return candidate && inventory(candidate, platform.profile) ? candidate : null;
      });
    }
    if (!panel || !active(run)) return false;
    record.touched.add(panel);
    instances.set(panel, record);
    // Re-inventory after every click: rerenders may replace controls or add a category.
    for (let changes = 0; changes < 24 && active(run); changes += 1) {
      panel = panelFor(platform);
      const current = panel && inventory(panel, platform.profile);
      if (!current) return false;
      const on = current.optional.find((control) => state(control) === true);
      if (!on) {
        await pause(run, SETTLE_MS);
        if (!active(run)) return false;
        panel = panelFor(platform);
        const final = panel && inventory(panel, platform.profile);
        if (!final || final.optional.some((control) => state(control) !== false)) return false;
        const saved = click(run, final.save);
        return saved && confirmed(run, root, platform);
      }
      const id = on.id;
      if (!id || !click(run, controlTarget(on, panel))) return false;
      const off = await until(run, () => {
        const fresh = panelFor(platform);
        const check = fresh && inventory(fresh, platform.profile);
        const control = check?.optional.find((element) => element.id === id);
        return control && state(control) === false;
      });
      if (!off) return false;
      await pause(run, 50);
    }
    return false;
  }
  async function attempt(run, root, platform) {
    if (!active(run) || completed.has(root)) return;
    let record = instances.get(root);
    if (!record) { record = { attempts: 0, done: false, touched: new Set([root]) }; instances.set(root, record); }
    if (record.done || record.attempts >= MAX_ATTEMPTS) return;
    const rejection = direct(root, platform);
    const panel = panelFor(platform);
    const hasPreferences = platform.profile && ((panel && inventory(panel, platform.profile)) || manage(root, platform));
    if (!rejection && !hasPreferences) return;
    record.attempts += 1;
    let success = false;
    if (rejection) success = click(run, rejection) && await confirmed(run, root, platform);
    else success = await preferences(run, root, platform, record);
    if (success && active(run) && !record.done) {
      record.done = true;
      for (const touched of record.touched) completed.add(touched);
      const eventId = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try { run.onDenied({ eventId, platform: platform.name }); } catch { /* UI failure must not re-click. */ }
    } else if (active(run) && record.attempts < MAX_ATTEMPTS) schedule(run, 500);
  }
  async function scan(run) {
    if (!active(run) || run.busy) { run.pending = true; return; }
    run.busy = true;
    try {
      for (const { root, platform } of scopes()) {
        if (!active(run)) break;
        await attempt(run, root, platform);
      }
    } catch { /* Unsupported/malformed CMP DOM fails closed. */ }
    finally {
      run.busy = false;
      if (run.pending && active(run)) { run.pending = false; schedule(run); }
    }
  }
  function schedule(run, delay = 90) {
    if (!active(run)) return;
    if (run.busy) { run.pending = true; return; }
    if (run.timer) return;
    run.timer = global.setTimeout(() => { run.timer = null; void scan(run); }, delay);
  }
  function stop() {
    if (!session) return;
    const run = session;
    run.stopped = true;
    run.observer.disconnect();
    global.clearTimeout(run.timer);
    for (const [timer, resolve] of run.waits) { global.clearTimeout(timer); resolve(); }
    run.waits.clear();
    session = null;
  }
  function start({ onDenied = () => {}, isEnabled = () => true } = {}) {
    stop();
    const run = { onDenied, isEnabled, actions: 0, stopped: false, busy: false, pending: false, timer: null, waits: new Map() };
    run.observer = new global.MutationObserver(() => schedule(run));
    session = run;
    run.observer.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
    schedule(run, 0);
    return stop;
  }
  global.QuietExitEngine = Object.freeze({ start, stop });
})(globalThis);
