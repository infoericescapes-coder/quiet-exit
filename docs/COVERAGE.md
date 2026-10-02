# Consent coverage

Quiet Exit 0.1.0 targets English consent interfaces in Chrome and Safari. The rules recognise the scopes below. Recognition does not guarantee that every deployment, theme or version of a consent manager can be handled.

| Consent manager | Direct rejection | Preferences without a reject control |
| --- | --- | --- |
| OneTrust | Known reject selectors and exact English rejection labels | Complete, rendered category rows in the supported `ot-pc-content` layout, with inspectable native checkboxes or ARIA switches |
| Cookiebot | Known decline selectors and exact English rejection labels | Four inspectable category controls: Necessary, Preferences, Statistics and Marketing |
| Klaro | Known decline selectors and exact English rejection labels | Flat service list only; grouped purpose layouts are left untouched |
| Quantcast, Didomi, Osano, Complianz, Iubenda | Exact English rejection labels inside recognised containers | No automatic save |
| Usercentrics, TrustArc, Sourcepoint, CookieYes, Cookie Consent | Exact English rejection labels when controls are accessible inside a recognised DOM container | No automatic save |
| Other cookie dialogs | Exact rejection labels after identifying an affirmative consent purpose from the dialog title or leading text | No automatic save |

The first three profiles inspect the whole supported panel, identify all controls, disable optional choices through their real UI, re-read state after each action, and inventory the panel again before saving. They do not submit when a control is unknown, unreadable, disabled, hidden without an accessible associated label, or when the structure indicates collapsed sections, vendor lists or legitimate-interest settings. A partially understood layout can be opened but will not be saved.

## Boundaries

- English labels only. Known selector rules are not a multilingual support claim.
- No closed or open shadow-root traversal in this version. Some Usercentrics and other installations use shadow DOM and will be left for manual handling.
- Content scripts run in permitted matching frames. Browser-protected documents, inaccessible frames and site-access restrictions can prevent operation.
- An unknown preference component, vendor list, paywall, multi-step consent wizard or purpose-group layout is not guessed.
- Three attempts per banner instance and 60 actions per active frame session bound retries. A stuck banner remains visible. After the frame action budget is exhausted, reloading the page or toggling the extension off/on starts a new session.
- A successful count records disappearance of the relevant interface after a deliberate rejection/save action. It does not inspect stored cookie values or verify server-side enforcement.
- Once a banner DOM instance is counted, it is not counted or acted on again during that document's lifetime. A newly created banner element may be handled separately.
- This is a development version. Broad live-site compatibility testing and store review have not been completed.

## Verification record

The first build was checked with 49 Node tests, independent source review, Chromium and WebKit DOM fixtures, and a loaded Chromium extension. Browser fixtures cover delayed appearance, exact rejection, unrelated buttons, pause/resume, asynchronous management, delayed ARIA toggle updates, and an unknown preference that must block saving. The real Chrome package test covers content-script injection, the background worker, persisted counting and the popup toggle.

Popup screenshots were inspected at 320px and checked for overflow at 320px, 390px and 800px. Fonts are bundled locally and the layout has no animation dependency.

Safari web resources build successfully. Native macOS/iOS packaging cannot be verified on the development host because full Xcode is not installed. The `npm run safari` command reports this condition and exits unsuccessfully; it does not produce a pretend app. Physical iPhone/iPad installation, Safari site-access behaviour and signed distribution remain outstanding.

Firefox was removed from scope at the owner's request.
