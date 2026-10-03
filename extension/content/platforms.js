/* Classic content script. Selectors identify CMP scopes, never page-wide actions. */
(function (global) {
  'use strict';
  global.QuietExitPlatforms = Object.freeze([
    { name: 'OneTrust', scopes: '#onetrust-banner-sdk, #onetrust-pc-sdk',
      reject: '#onetrust-reject-all-handler, .ot-pc-refuse-all-handler',
      manage: '#onetrust-pc-btn-handler', panel: '#onetrust-pc-sdk', profile: 'onetrust' },
    { name: 'Cookiebot', scopes: '#CybotCookiebotDialog',
      reject: '#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
      manage: '#CybotCookiebotDialogBodyEdgeMoreDetails, #CybotCookiebotDialogBodyButtonDetails',
      panel: '#CybotCookiebotDialog', profile: 'cookiebot' },
    { name: 'Klaro', scopes: '.klaro .cookie-modal, .klaro .cookie-notice, #klaro-cookie-notice',
      reject: '.cm-btn-decline, .cn-decline', manage: '.cn-learn-more, .cm-btn-lern-more',
      panel: '.klaro .cookie-modal', profile: 'klaro' },
    { name: 'Quantcast', scopes: '.qc-cmp2-container, .qc-cmp2-ui' },
    { name: 'Didomi', scopes: '#didomi-notice, .didomi-popup-container' },
    { name: 'Osano', scopes: '.osano-cm-dialog, .osano-cm-info-dialog' },
    { name: 'Complianz', scopes: '.cmplz-cookiebanner' },
    { name: 'Iubenda', scopes: '#iubenda-cs-banner, .iubenda-cs-preferences' },
    { name: 'Usercentrics', scopes: '#usercentrics-root, [data-testid="uc-default-wall"], #uc-cmp-container' },
    { name: 'TrustArc', scopes: '#truste-consent-content, #truste-consent-track, #consent_blackbar' },
    { name: 'Sourcepoint', scopes: '[id^="sp_message_container_"]' },
    { name: 'CookieYes', scopes: '.cky-consent-container, .cky-modal' },
    { name: 'Cookie Consent', scopes: '.cc-window, #cookie-law-info-bar' }
  ].map(Object.freeze));
})(globalThis);
