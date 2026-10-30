# Xcode 27.1 fallback simulator smoke evidence

This separate phase records bounded upgrade, retained-state and direct OFF→ON checks of **Quiet Exit 0.1.3 (2)** built with **Xcode 27.1 (27A9275), simulator SDK 27.1**, then installed on the existing **iOS 27.2 iPhone Duo and iPhone 18 Pro simulators**. The primary performed the installs, containing-app launches and Safari actions. The packaging helper independently read all eight saved event states and visually inspected all nine screenshots, including the final native switch/count states; it did not repeat the native execution.

These checks do **not** rerun the 26-case matrix, delayed queue, bfcache, restart or live-site lifecycle suite. The earlier full matrix and lifecycle evidence in the [parent folder](../README.md) remains evidence for the original SDK 27.2/build-1 phase. Build SDK 27.1 is distinct from simulator OS 27.2. Physical-device execution, distribution signing and upload acceptance are outside this smoke package.

## Build identity

[build-identity-xcode27.1.json](build-identity-xcode27.1.json) is copied unchanged from the artifact audit. Both app and embedded extension have their expected bundle IDs, version 0.1.3, build 2 and minimum iOS 15.4. Their `DTXcode` is `2710`, `DTXcodeBuild` is `27A9275`, `DTSDKName` is `iphonesimulator27.1`, and `DTSDKBuild` is `24A94232`. All 34 `dist/safari` resources matched the extension bundle byte-for-byte. The Debug plists omit the non-exempt-encryption key; the audit records `null` and does not reinterpret that as a release declaration.

The audit records source commit `21f1d4f0eba5feab06fe039e08cae6e8a6b398f2`, whose committed tree equals previously tested `e43452fd1f2192b395f00b99a20c47de14a7c317`. It explicitly lists the then-dirty documentation paths (`FOUNDATION-HANDOFF.md`, `docs/IOS-TEST-RESULTS-2026-10-31.md` and the new `docs/TESTFLIGHT-2026-10-31.md`); it makes no clean-worktree claim. The primary supplied the successful build/install/launch observations. Bundle identity and resource comparison establish the local build contents, not runtime behaviour on their own.

## Captured state checks

Each label has exactly four saved events, ordered by numeric `sequence`: `document-ready`, `pageshow` (`persisted: false`), `insert`, then `reject`. No event claims bfcache restoration. All eight snapshots have `accept: 0`, no queued insertion and visible document state.

| Device / evidence label | Run and document | Sequence 3, paused insertion | Sequence 4, after native enable | Visually confirmed popup states |
| --- | --- | --- | --- | --- |
| Duo / `duo-xcode271-smoke` | Run `a47c023b-4c91-4080-8c31-e5e6e0daa34c`; document `82fa1592-ed26-4861-8ec8-9ab1bce33ff0` | `inserted: 1`, `reject: 0`, `accept: 0`, `surfacePresent: true` | `inserted: 1`, `reject: 1`, `accept: 0`, `surfacePresent: false` | Retained **Paused / 8**; enabled **9**; final **Paused / 9**. |
| iPhone 18 Pro / `iphone18pro-xcode271-smoke` | Run `c6c2e7d0-16ff-498f-85a5-3165eff40640`; document `23d5d3e4-a909-4db6-96b3-625e59b69558` | `inserted: 1`, `reject: 0`, `accept: 0`, `surfacePresent: true` | `inserted: 1`, `reject: 1`, `accept: 0`, `surfacePresent: false` | Retained **Paused / 7**; enabled **8**; final **Paused / 8**. |

The off-banner screenshots visibly retain the actual direct fixture with its Accept all and Reject all buttons and page counters `Accept 0 / Reject 0 / Inserted 1`. Enabled captures and event 4 show the rejection and removed banner. Popup state/count observations are read from the native screenshots, not inferred from filenames or from the page's event logger. The final iPhone 18 Pro screenshot was also inspected at original resolution to read its visible count 8.

The first Duo URL used a dot in its device label, which the frozen instrument rejects with HTTP 400. It produced no lifecycle events; the corrected hyphenated label produced this valid four-event run. This is an input-validation/operator correction, not an extension failure. On iPhone, the primary reports that a first toggle tap landed on text after the native sheet height changed. The preserved before-enable screenshot visibly remains **Paused / 7**, with the banner untouched; the later enabled screenshot and event 4 record the successful change. The missed tap is not labelled a product defect.

## Replay with the frozen parent instrument

Use the [parent replay instructions](../README.md) and the unchanged [lifecycle instrument](../native-lifecycle-harness.mjs). Copy it into the required repository artifact location, rather than executing it from this evidence folder:

```sh
mkdir -p artifacts/ios-2026-10-31
cp docs/evidence/2026-10-31/native-lifecycle-harness.mjs artifacts/ios-2026-10-31/native-lifecycle-harness.mjs
node artifacts/ios-2026-10-31/native-lifecycle-harness.mjs --self-check
node artifacts/ios-2026-10-31/native-lifecycle-harness.mjs
```

Install/launch the intended simulator build through the separately authorised native procedure. Open `http://127.0.0.1:8768/?device=duo-xcode271-smoke` or `http://127.0.0.1:8768/?device=iphone18pro-xcode271-smoke`; entry creates a fresh `run` query. Verify the retained paused state/count in the real popup, insert one direct fixture, observe zero consent clicks while paused, then enable through the real popup. Check one rejection, zero acceptance, removal and a popup increment of one. Pause again and capture the final native popup. Device labels identify evidence only; they do not choose or inject an engine. The lifecycle page never changes extension storage or switch state.

The original lifecycle server session `92458` was stopped after the primary's checks; replay requires a new server. Event files remain after shutdown. No server was started, UI controlled, build run or install performed during packaging. The instrument self-check is only an instrument check, not native verification.

## Files and capture metadata

This folder contains eight unchanged lifecycle JSON events, nine unchanged PNG screenshots, the unchanged build-identity JSON, this README and [capture-metadata.json](capture-metadata.json). Each event's recorded lifecycle-instrument hash matches the frozen parent copy. The screenshot metadata records bytes, SHA-256 and original artifact filesystem modification times. These are filesystem observations, not camera capture times, trusted-clock proof or exact switch-transition timestamps. Copied-file modification times can differ from the original artifact times.

| Screenshot | Independently viewed content |
| --- | --- |
| [duo-xcode271-smoke-paused8.png](duo-xcode271-smoke-paused8.png) | Paused, count 8 before insertion. |
| [duo-xcode271-smoke-off-banner.png](duo-xcode271-smoke-off-banner.png) | Direct banner retained; Accept 0 / Reject 0 / Inserted 1. |
| [duo-xcode271-smoke-enabled9.png](duo-xcode271-smoke-enabled9.png) | Enabled, count 9. |
| [duo-xcode271-smoke-final-paused9.png](duo-xcode271-smoke-final-paused9.png) | Final Paused, count 9. |
| [iphone18-xcode271-smoke-paused7.png](iphone18-xcode271-smoke-paused7.png) | Paused, count 7 before insertion. |
| [iphone18-xcode271-smoke-off-banner.png](iphone18-xcode271-smoke-off-banner.png) | Direct banner retained; Accept 0 / Reject 0 / Inserted 1. |
| [iphone18-xcode271-smoke-before-enable-paused7.png](iphone18-xcode271-smoke-before-enable-paused7.png) | Still Paused, count 7, with the inserted banner untouched. |
| [iphone18-xcode271-smoke-enabled8.png](iphone18-xcode271-smoke-enabled8.png) | Enabled, count 8; Accept 0 / Reject 1 / Inserted 1, banner removed. |
| [iphone18-xcode271-smoke-final-paused8.png](iphone18-xcode271-smoke-final-paused8.png) | Final Paused, count 8. |
