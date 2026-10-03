# iOS verification — 3 October 2026

Status: simulator core flows passed; physical iPhone installed but launch blocked by its lock screen; physical iPad testing deferred by Eric until TestFlight. No distribution archive, export or TestFlight upload has completed. Release credential use awaits Eric's presence confirmation under his standing signing instructions.

## Provenance

- Mac: Eric’s Mac mini (MacminiM4); macOS 27.0 (26A428), Node 26.4.0.
- Repository: `infoericescapes-coder/quiet-exit`, branch `codex/initial-extension`; clean clone began at `768ed2c8cbc8f14362992e7419275fc2c982e9a1`.
- Default Xcode 26.6 (17F113); Xcode 27.0 (27A266a) used via command-scoped `DEVELOPER_DIR` for physical-device development build. Global Xcode selection was preserved.
- Native project: generated local `safari/Quiet Exit/Quiet Exit.xcodeproj`, scheme `Quiet Exit (iOS)`. Generated wrapper remains ignored and existing native settings were preserved.
- App `com.ericescapes.quietexit`; appex `com.ericescapes.quietexit.Extension`. Built app and extension both verified as version 0.1.2, build 1. Existing wrapper builds used explicit `MARKETING_VERSION=0.1.2 CURRENT_PROJECT_VERSION=1`.
- Fixture server: included `scripts/manual-fixtures.mjs --lan --port=8766`; port 8765 was occupied and untouched. Real installed Safari extension; fixtures do not inject extension code. One-day access granted only to `127.0.0.1` in simulator Safari.

## Fixes and automated checks

1. Safari MV3 background now uses `service_worker`; Safari-only unsupported `match_about_blank` is omitted. Final Apple packager check emitted no manifest warnings. Chrome manifest behavior is preserved; Firefox remains excluded.
2. Preferences reject observable shadow roots, custom-element hosts, customized built-ins and embedded/non-inspectable surfaces before saving. Eleven adversarial tests cover these cases; ten reproduced unsafe behavior on the original code before the fix.
3. Counter delivery retries missing, rejected, negative and timed-out acknowledgements with the original event ID. Three attempts, two-second acknowledgement timeout, bounded queue; existing background deduplication prevents a dropped acknowledgement counting twice. Consent actions themselves are not retried by this reporting layer.
4. Fresh wrapper generation stamps the package version and iOS 15.4 minimum required by [Safari MV3](https://developer.apple.com/videos/play/wwdc2022/10099/); existing wrapper refusal protects native edits. A final simulator rebuild with an explicit iOS 15.4 override succeeded, and both app/appex MinimumOSVersion values were read back as 15.4. It emitted only two App Intents metadata warnings because this wrapper has no AppIntents.framework dependency. The earlier incremental icon build was warning-free. macOS minimum deployment compatibility remains outside this iOS release scope.
5. Icon generation reuses existing safe asset filenames and preserves metadata. Eleven orphan Apple template images from the earlier local generation were moved into ignored evidence storage, not deleted. The final iPhone incremental build was warning-free.

`npm ci` completed with zero reported vulnerabilities. Final `npm run check`: **84/84 Node tests**, Chromium and WebKit DOM/popup checks, and real loaded Chromium extension checks passed. `npm run package` passed. Independent review found no remaining blocker in the scoped changes; independent targeted verification passed 25 content/background/popup tests, five wrapper tests and six icon tests. Safari popup CSS and Eric Escapes branding were unchanged.

## Native simulator results

| Check | iPhone 17 Pro — iOS 26.5 | iPad Pro 13-inch (M5) — iOS 26.5 |
| --- | --- | --- |
| Build, install, containing-app launch | PASS | PASS |
| Cookie-off application icon / Safari toolbar icon | PASS | PASS |
| Popup portrait / landscape | PASS; expand sheet and scroll landscape to reach all content; no width collapse | PASS; switch, count and branded footer fit |
| Direct rejection | PASS: reject 1, accept 0, unrelated 0; count 0→1 | PASS: same; count 0→1 |
| Five-second late banner | PASS: one additional rejection | PASS: one additional rejection; count reached 3 after preferences |
| Complete Cookiebot preferences | PASS: three optional clicks, one save; Necessary true, all three optional settings false; aggregate count 3 | PASS: same saved state; count 1→2 |
| Unknown optional control | PASS: remains visible/checked; zero additional optional clicks, saves or accepts | PASS: same; aggregate save 1 / optional clicks 3 unchanged |
| Switch off: immediate and five-second insertion | PASS: no new rejection or acceptance | PASS: no new rejection/acceptance; count stayed 4 |
| Switch/count after terminating and reopening Safari | PASS: paused and count 3 preserved | PASS: paused and count 4 preserved |
| Resume pending direct banner | PASS: rejected and counted once | Not separately exercised |
| Genuine bfcache off/resume | PASS: `pageshowPersisted: true`; paused restored page leaves new banner; enabling changes count 4→5 once | Not exercised |
| Genuine bfcache while enabled | PASS: restored prior completed banner adds no count; count stays 5 | Not exercised |

On iPad, an attempted “queue while enabled, then disable before five seconds” interaction missed the time window: the banner was already rejected before pause and the count became 4. That timing case is **inconclusive**, not a pass. Subsequent immediate and queued insertions after pause was visibly confirmed remained untouched. On iPhone, the queued test also started while already paused; disabling during a pending insertion still needs a timed native run.

The remaining native negative fixture matrix (unreadable/disabled/hidden/missing controls, vendors, legitimate interest, collapsed sections, stuck reject and replacement preferences) was not exhaustively repeated on each simulator. These paths have automated adversarial coverage. No live production-site compatibility claim follows from these synthetic tests.

## Physical devices

- **iPhone 17 Pro, reported iOS 27.0.1:** initial connectivity disappeared, and the first installation attempt failed with CoreDevice 4016. Xcode 27 generic iOS development build succeeded using Eric’s existing development team. When the device became available again, `devicectl device install app` succeeded for `com.ericescapes.quietexit`. Launch then failed with CoreDevice 10002 / FBSOpenApplicationErrorDomain 7, reason **Locked**. Safari extension activation, popup, consent behavior and counters on this physical phone remain unverified.
- **Physical iPad Pro:** unavailable. Eric explicitly deferred its testing until the TestFlight build is available.
- No distribution keychain was used for these development builds. No keychain passwords were requested.

## Release follow-up and known limits

The current request authorizes TestFlight submission once ready; older handoff wording prohibiting upload does not revoke it. Signing still follows Eric’s separate requirement that he be present, using a disposable per-run keychain and `/usr/bin/rsync` export shim. The App Store Connect app record, available build number, distribution provisioning and processing status have not yet been verified. `scripts/release-ios.sh` prepares the scoped archive/export/upload path; it defaults to local preflight and requires explicit `--execute`, verified account/build inputs and the reviewed local App Store Connect helper. Shell syntax and static review do not establish release execution success. No TestFlight availability is claimed.

Counter delivery is bounded best effort: exhaustion, queue overflow, navigation or disabling may discard an unacknowledged report. An already in-flight background operation may still finish after disabling. Closed shadow roots on ordinary native hosts are not observable by this inventory; support outside inspected layouts is unknown. A count reflects interface disappearance after a rejection action, not proof of server-side consent enforcement.

## Selected screenshots

- [iPhone portrait popup](evidence/2026-10-03/iphone-popup-portrait.png)
- [iPhone saved optional-off states](evidence/2026-10-03/iphone-preferences-saved.png)
- [iPhone unknown panel not saved](evidence/2026-10-03/iphone-unknown-no-save.png)
- [iPhone landscape count and footer](evidence/2026-10-03/iphone-popup-landscape-counter.png)
- [iPhone bfcache resume count 5](evidence/2026-10-03/iphone-bfcache-resume-count5.png)
- [iPad containing app and icon](evidence/2026-10-03/ipad-containing-app.png)
- [iPad popup count 3 and saved-state evidence](evidence/2026-10-03/ipad-count3.png)
- [iPad unknown panel not saved](evidence/2026-10-03/ipad-unknown-no-save.png)
- [iPad landscape popup after Safari restart](evidence/2026-10-03/ipad-popup-landscape.png)

Full local build/check logs and additional screenshots remain in ignored `artifacts/ios-testing-2026-10-03/`. Screenshots above contain synthetic fixtures only.
