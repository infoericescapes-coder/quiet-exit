# Consent coverage

Quiet Exit 0.1.2 targets English consent interfaces in Chrome and Safari. The rules recognise the scopes below. Recognition does not guarantee that every deployment, theme or version of a consent manager can be handled.

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
- No general shadow-root traversal in this version. Mixed shadow-DOM and custom-host layouts fail closed when the panel cannot be fully inspected. Closed roots and embedded surfaces whose controls cannot be inspected remain unobservable and may require manual handling; this is not a claim of support for all sites.
- Content scripts run in permitted matching frames. Browser-protected documents, inaccessible frames and site-access restrictions can prevent operation.
- An unknown preference component, vendor list, paywall, multi-step consent wizard or purpose-group layout is not guessed.
- Three attempts per banner instance and 60 actions per active frame session bound retries. A stuck banner remains visible. After the frame action budget is exhausted, reloading the page or toggling the extension off/on starts a new session.
- A successful count records disappearance of the relevant interface after a deliberate rejection/save action. It does not inspect stored cookie values or verify server-side enforcement.
- Once a banner DOM instance is counted, it is not counted or acted on again during that document's lifetime. A newly created banner element may be handled separately.
- This is a development version. Broad live-site compatibility testing and store review have not been completed.

## Historical verification record (initial build)

The first build was checked with 49 Node tests, independent source review, Chromium and WebKit DOM fixtures, and a loaded Chromium extension. Browser fixtures cover delayed appearance, exact rejection, unrelated buttons, pause/resume, asynchronous management, delayed ARIA toggle updates, and an unknown preference that must block saving. The real Chrome package test covers content-script injection, the background worker, persisted counting and the popup toggle.

Popup screenshots were inspected at 320px and checked for overflow at 320px, 390px and 800px. Fonts are bundled locally and the layout has no animation dependency.

Safari web resources and the generated native wrapper build successfully. The following is historical: the initial development host had Command Line Tools only, so native packaging was then unavailable; that statement does not describe the current run.

Firefox was removed from scope at the owner's request.

### Safari popup fix, 3 October 2026

Native macOS Safari 27 displayed a blank, narrow popover while its accessibility tree still contained the loaded popup. The popup now supplies an intrinsic 320px minimum document width, a 340px preferred width and an explicit root background. This prevents collapse while Safari measures the content for its popover; a viewport cap still fits widths between 320px and 340px.

The installed temporary extension was reloaded in Safari and verified visually. Pausing persisted after closing/reopening the popup, then enabling restored operation. On a local synthetic OneTrust banner, Safari clicked rejection automatically and the popup count increased from 0 to 1. This is native extension verification with a fixture, not proof of Klook or every live consent-manager deployment.

The browser checks now load the actual popup CSS in Chromium and WebKit at an initial 50px viewport and require a non-collapsed document. They then check 320, 321, 330, 340 and 390px viewports for overflow. At the time of this entry, signed Safari wrapper distribution and physical-device verification remained outstanding; the 3 October current status below records subsequent device results.

### Current verification, 3 October 2026

The starting checkout was clean clone `768ed2c` on `codex/initial-extension`, version 0.1.2. The final `npm run check` passed 84 tests plus Chromium, WebKit and loaded-Chrome checks; `npm run package` passed. Safari packaging changes use an MV3 background service worker without packager warnings, omit Safari's unsupported `match_about_blank`, and reuse existing icon filenames without adding orphan images. Counter delivery retries use a stable message ID, with a maximum of three attempts including negative acknowledgements and timeouts. The native version generator produced fresh version 0.1.2, build 1 while preserving CLI version overrides.

Native builds, installs and containing-app launches succeeded on iPhone 17 Pro and iPad Pro 13-inch (M5) simulators, both running iOS 26.5. On iPhone Safari, popup and icons were enabled and site permission was granted for `127.0.0.1`. Direct rejection recorded reject 1, accept 0, unrelated 0 and counter 0→1; the late five-second fixture added one rejection. Complete Cookiebot preferences produced three optional clicks and one save, with Necessary true and Preferences, Statistics and Marketing false; the counter reached 3. An unknown optional panel was left untouched and unsaved. The popup showed all content in portrait and landscape, including the Eric Escapes footer. After Safari termination and reopen, the switch and count 3 persisted. A confirmed bfcache restoration (`pageshowPersisted: true`) with the switch off left a new direct fixture untouched at count 4; enabling it rejected once and raised the count to 5. With the switch enabled across another away/back navigation, the count stayed at 5.

On the iPad simulator, direct rejection moved the counter 0→1, complete Cookiebot preferences (three optional clicks, one save, all optional categories off) moved it to 2, and the late five-second fixture moved it to 3. An unknown control caused no additional click or save. A queued banner was rejected just before pause and moved the counter to 4, but that timing attempt was inconclusive. In the paused state, an immediate banner and a banner queued for five seconds both remained visible and the count stayed at 4. After Safari restart, the popup remained paused with count 4. The iPad popup fit in portrait and landscape with the full Eric Escapes footer visible. App icons and toolbar icons were checked on both simulators.

A physical iPhone was later available: Xcode 27 development installation succeeded, but launch failed with CoreDevice 10002/FBS 7, so physical Safari behavior was not tested. The physical iPad was unavailable and is deferred until TestFlight testing. No TestFlight upload has occurred; its status remains pending. Native queue-disable timing and the broader negative-fixture matrix have not been fully tested.

See [iOS test results, 3 October 2026](IOS-TEST-RESULTS-2026-10-03.md) for the execution record. Counter retries are finite, so delivery can still be lost after exhausted retries. Closed shadow roots and native embedded surfaces can be unobservable; behaviour outside the verified layouts remains unknown. Live-site coverage remains unverified.
