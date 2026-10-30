# Installed iOS Safari testing, 31 October 2026

Current 0.1.3 testing used the real installed Safari web extension in Apple's Device Hub simulators. This is separate from the earlier page-script Safari harness and Playwright tests. Physical devices and iPad are not covered by this run.

## Build and source identity

- Checkout: `codex/consent-outcome-hardening`, starting at `20d4f1897902aa4e086510409814ea7af6b1f498`.
- The tested tree adds Xcode 27 packaging support in `scripts/safari.mjs` and four regression cases in `tests/safari-wrapper.test.mjs`. Product consent scripts were unchanged. Documentation/evidence were added after testing.
- macOS 27.2 (26B123), Xcode 27.2 (27B52), Node 24.14.1; developer directory `/Applications/Xcode.app/Contents/Developer`.
- Project `safari/Quiet Exit/Quiet Exit.xcodeproj`, scheme `Quiet Exit (iOS)`, Debug simulator build.
- Both `com.ericescapes.quietexit` and embedded `com.ericescapes.quietexit.Extension` report **0.1.3 (1)**, minimum iOS 15.4. Bundled web resources matched `dist/safari` byte for byte. Build 1 is a local simulator identity, not a new upload or an available distribution build number.
- iPhone 18 Pro: `A4A7197B-3903-43EE-A3E9-3A30C0A04E9D`; iPhone Duo: `11E7AF04-6698-4DBC-987F-042FFB5AB210`; both iOS 27.2. Device Hub and `devicectl` identify these as **simulated**, not connected physical phones.

Xcode 27's packager produced `project.xcproj` instead of the older `project.pbxproj`. The wrapper script originally failed before stamping the version. It now recognises both formats, preserving their syntax and unrelated settings. The failed task-created wrapper was preserved under ignored artifacts before generating a new wrapper. Existing user wrappers were not replaced.

Validation passed: **124 unit tests**, existing browser/popup checks, **42 consent regression cases**, `npm run package`, wrapper generation/icons, and native build/install/launch on both destinations. The focused wrapper suite passed **9/9**; its four new cases failed against the original implementation. A separate reviewer verified the fix and actual generated-project stamping. Release preflight now also recognises both project formats, checks exact bundle IDs, and accepts an optional absolute `DISTRIBUTION_PRIVATE_KEY` path so an existing key can be used in place. Its 15 focused tests cover both formats, incorrect identifiers and a nonexecuting key-path guard. The keychain/archive/export/upload logic is unchanged apart from that key-path selection.

## Installed-extension matrix

The local instrument serves real synthetic interfaces, without injecting Quiet Exit code, mocking extension APIs, writing consent cookies or accessing extension storage. Safari's installed extension supplies all automatic actions. Quiet Exit was explicitly enabled in Safari, with **Allow for One Day** for `127.0.0.1`. The popup's own switch was paused for each disabled baseline.

| Test | iPhone 18 Pro | iPhone Duo |
| --- | --- | --- |
| Disabled baseline, 26 cases | 26/26; popup 0 → 0 | 26/26; popup 0 → 0 |
| Enabled matrix, 26 cases | 26/26; popup 0 → 3 | 26/26; popup 0 → 3 |
| Accept / other / unrelated actions | All zero | All zero |

The 26 cases comprise 13 wording/opacity/replacement patterns, direct rejection, complete preferences, five-second late insertion, eight incomplete preference inventories, and two unresolved rejection interfaces. Positives confirm one direct rejection, three optional controls off followed by one save with Necessary still on, and one late rejection. Incomplete preference layouts stay untouched. Remaining/replacement interfaces do not increment the counter; stuck rejection is observed for 12 seconds.

The matrix runs in same-origin frames with the installed package's frame support. It establishes those frame behaviours; the lifecycle instrument separately exercises top-level pages. Its visibility assertion checks document visibility changes and final frame geometry, not continuous visibility of every control. Popup counts are independent native observations, not inferred from harness expectations.

## iPhone 18 Pro lifecycle and popup

| Observation | Evidence and result |
| --- | --- |
| Pause before queued insertion | Queue at 15:50:31.829 UTC, due 15:51:01.829; screenshot shows Paused/count 3 at 15:50:58.431, 3.398 seconds before due. Actual insertion 15:51:01.831 stayed untouched. Resume produced one rejection at 15:51:11.734 and count 4. |
| Fresh top-level direct control | One rejection, zero acceptance, count 4 → 5. |
| Enabled bfcache restoration | Same document, real `pageshow.persisted=true`; new banner rejected once, count 5 → 6. No duplicate count for the earlier rejection. |
| Paused bfcache restoration | Same document restored with `persisted=true`; inserted banner remained while paused at count 6. Resume rejected once and count became 7. |
| Safari restart persistence | Native stop and relaunch of `com.apple.mobilesafari`; reopened popup remained Paused/count 7. Screenshot proves post-state; primary tool logs record the restart. |
| Popup/layout | Switch, count, status and Eric Escapes footer readable/reachable in portrait and landscape. Landscape requires scrolling. App and Safari extension icons were visible. |

Queue timing uses a deliberate 30-second queue to allow native popup interaction. The separate matrix covers the original five-second late insertion. Lifecycle evidence sorts by document ID and numeric sequence, not network arrival order.

The first history attempt accidentally followed Safari Forward after the toolbar layout changed. Its history phase is retained as **invalid operator navigation**, not a product failure. Its earlier queue phase remains valid. The corrected history run is `0ec33088-549e-42ba-8deb-020c61a70ad7`, document `4719e7c5-4431-4090-9b4e-89b8ad51759e`: sequences 6 and 10 record genuine persisted restoration, 7/8 record enabled insertion/rejection, and 11/12 record paused insertion/resumed rejection. All acceptance counts are zero. An independent reviewer checked the raw events, source hashes and screenshots.

## iPhone Duo lifecycle and popup

Run `a6ad3443-a3ce-4493-9f06-8ab2748ffe7e`, document `63d95fe2-6885-45ee-864d-d295007e7342`, retains 20 events. Tests used the open inner display in landscape.

| Observation | Evidence and result |
| --- | --- |
| Queue repeat with proven pause deadline | Sequence 8 queued at 16:20:26.873 UTC, due 16:20:56.873. Paused/count 4 screenshot was captured 11.390 seconds before due. Sequence 10 insertion stayed untouched; sequence 12 resume rejected once, count 4 → 5. |
| Enabled bfcache restoration | Sequence 14 records genuine `pageshow.persisted=true`; 15/16 insert/reject once, count 5 → 6. |
| Paused bfcache restoration | Sequence 18 records genuine persisted restoration; sequence 19 insertion stays untouched at count 6. Sequence 20 resume rejects once, count 6 → 7. All recorded acceptance counts remain zero. |
| Safari restart persistence | Native Safari stop/relaunch at 16:23:55 UTC; reopened popup remains Paused/count 7. |
| Popup/layout | Full popup, switch, count and footer readable in inner portrait and landscape. Closed-display switch operation was checked; complete closed-display footer coverage is not claimed. |

The first queue's paused screenshot was captured **2.535 seconds after** insertion was due. That attempt's before-deadline timing is inconclusive, although its paused/resumed outcome was observed. The separate repeat above resolves the timing requirement. Capture times are filesystem observations, not a trusted external clock. An independent reviewer checked the raw matrix/lifecycle events and screenshots.

## Live Best Lawyers on iPhone Duo

Opened `https://www.bestlawyers.com/` in a fresh simulator Safari tab. The visible notice offered **Only Use Essential Cookies** and **Accept All Cookies**. Quiet Exit was Paused/count 7; access was granted for one day to this site. The native location request was declined. No consent button was pressed manually and no product engine or page SDK was injected.

A read-only, bounds/checksum-validated native cookie snapshot at 16:32:26 UTC contained no matching `bl_cookie_policy_V4` record. Enabling Quiet Exit removed the notice and changed its own popup count **7 → 8**. At 16:33:40 UTC, the native store contained exactly one matching record, domain `www.bestlawyers.com`, path `/`, value **`0`**. After pausing and reloading, the notice stayed absent, the popup remained Paused/count 8, and a 16:36:37 UTC snapshot still contained that one value `0`.

This is an installed live-site result corroborated by persisted native consent state. The extension's count requires its page-visible cookie postcondition, but an independent Web Inspector/document-cookie read and live click-event trace were not captured. The disk snapshot cannot exclude an unflushed live cookie; baseline absence alone is not proof of an empty live cookie jar. This does not establish server-side enforcement or stopped tracking. The earlier handoff's stricter independent page-visible-cookie check remains outstanding; do not label the narrower evidence as that check.

## Evidence, replay and remaining work

[Committed evidence and replay instructions](evidence/2026-10-31/README.md) include the unchanged instruments, structured results, build identity and selected screenshots. Larger build/test logs and DerivedData remain in ignored `artifacts/ios-2026-10-31/` on the testing Mac.

Still required before full native release sign-off: physical iPhone/iPad Safari behaviour, current iPad simulator coverage, and the independent page-visible-cookie portion of the Best Lawyers procedure described above. Localhost cases alone cannot validate that hostname-bound adapter. These results do not prove universal stored refusal or stopped tracking.

At completion of these simulator checks, no new distribution upload had occurred. Eric subsequently authorised building and uploading 0.1.3 from this MacBook Air after testing and supplied the existing matching distribution key. Release execution/readback will be recorded separately; the local simulator build number 1 must not be confused with a new TestFlight build. Physical-device/public-release sign-off remains outstanding.

Task-owned fixture servers on ports 8765, 8767 and 8768 were stopped after testing. Both simulator extensions were left paused (iPhone 18 Pro count 7; Duo count 8 after the live test).
