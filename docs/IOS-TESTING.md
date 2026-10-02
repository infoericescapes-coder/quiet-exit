# iPhone and iPad Safari testing on MacminiM4

This is a version 0.1.2 development handoff for the `codex/initial-extension` branch. The web resources can be built locally; the generated Xcode wrapper, iOS simulator installation and physical iPhone/iPad behaviour remain unverified. The preparation machine has Command Line Tools, not full Xcode. A Safari resource ZIP is not an installable iOS app. The new transparent toolbar icon and popup were visually verified in the installed temporary extension on macOS Safari; 52 Node tests and the Chromium/WebKit checks passed.

## Prepare on MacminiM4

Use the repository checkout on MacminiM4. Confirm the checkout and preserve existing changes before updating it:

```sh
git status --short
git branch --show-current
git rev-parse HEAD
node --version
xcode-select -p
xcodebuild -version
```

Node.js 22+ and full Xcode are required. If the selected developer directory is Command Line Tools, select the installed Xcode in Xcode Settings → Locations → Command Line Tools. Finish Xcode first-launch setup and install an iOS simulator runtime through Xcode Settings. Record the actual Xcode, macOS and simulator/device OS versions in the test report.

```sh
npm ci
npm run check
npm run package
npm run safari
```

If browser binaries are missing, run `npx playwright install chromium webkit`, then repeat the failed check. `npm run safari` builds the resources and invokes the first available Apple packager/converter. Capture its manifest warnings; investigate unsupported keys before treating installation as successful.

Open the generated `.xcodeproj` under `safari/`. The script deliberately refuses to replace an existing directory. Reuse an existing project when possible and preserve native edits. If regeneration is needed, use a separate output location; do not delete an existing wrapper. Apple's tool can also add iOS to an existing project with `--rebuild-project`, but back up that project first. Verify the generated project contains an iOS app and Safari extension target. [Apple packaging guidance](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).

The application icon master is `design/icons/app-icon-1024.png`. `npm run safari` populates the generated app icon asset sets automatically. For an existing wrapper, run `npm run safari:icons` to refresh them. This replaces app icon slots only and preserves other catalogue metadata and signing settings; unknown slot formats stop with an error for inspection. Inspect the icon in Xcode's asset catalogue, installed containing app and Safari extension controls; the web manifest icon alone does not prove the iOS app icon is configured correctly.

The default tool behaviour references `dist/safari` rather than copying it. Keep the checkout at its current path. After web-source changes, run `npm run build`, then Product → Run again to deploy updated resources. Inspect Xcode's resource references if a build appears stale. Do not hand-edit generated `dist/` files. [Apple resource-reference guidance](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).

## Install and enable

1. Start with the containing **iOS app scheme**, choose an iPhone simulator and Product → Run. Repeat with an iPad simulator. Running the app installs its embedded extension; the extension target alone is not the containing app.
2. In simulator Safari, open the page menu → Extensions and enable Quiet Exit. Alternatively find Safari → Extensions in Settings (under Apps on versions with that grouping). Grant website access for the fixture host. Open the Quiet Exit popup and check its switch and count are readable in portrait and landscape.
3. For a physical device, connect and trust the iPhone/iPad, enable Developer Mode if Xcode requests it, and select it as the run destination. Apple's current documentation requires Apple Developer Program membership for device testing; simulators can be used before joining. Have the user configure their development team and unique app/extension identifiers in Xcode when device installation needs them. This handoff does not configure signing or distribute an app.
4. Product → Run the containing app, then enable its extension and grant fixture website access on that device. Record installation or entitlement errors verbatim. [Apple installation and update guidance](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension), [iPhone extension controls](https://support.apple.com/guide/iphone/get-extensions-iphab0432bf6/ios).

## Run the fixture server

From the repo root, in a separate terminal:

```sh
node scripts/manual-fixtures.mjs
```

Open `http://127.0.0.1:8765/` in Mac Safari or simulator Safari. For a physical iPhone/iPad on the same Wi-Fi, explicitly enable LAN listening:

```sh
node scripts/manual-fixtures.mjs --lan
```

Open `http://<MacminiM4-LAN-IP>:8765/` on the device. `127.0.0.1` on a physical device refers to that device, not the Mac. Use the Mac's Wi-Fi address from System Settings → Network; allow incoming Node connections if macOS asks. The default server binds only loopback. LAN mode serves only synthetic fixtures and two bundled fonts, not the repository or extension internals. Stop it with Control-C. An occupied port can be changed with `--port=8766`.

The page does not inject extension code. Test with the real installed extension and its real popup. Reload between scenarios; page evidence resets, while the popup count persists. Compare **count deltas** against the baseline before each run. Don't manually click consent controls while checking automatic behaviour.

| Scenario | Expected automatic result with switch on |
| --- | --- |
| Direct rejection | `reject: 1`, `accept: 0`, interface disappears, popup count +1 |
| Late banner | Same result after the five-second insertion; no extra count |
| Complete Cookiebot preferences | Three optional clicks, one save, saved Necessary true and Preferences/Statistics/Marketing false; count +1 |
| Unknown control; unreadable state; disabled optional-on; hidden optional; missing category | No optional clicks, save, acceptance or count increase; panel remains |
| Hidden vendors; legitimate interest; collapsed categories | No save or count increase; panel remains |
| Reject leaves banner open | Rejection attempts bounded to three; no count increase after at least 12 seconds |
| Reject opens preferences | Incomplete replacement remains; no count increase |
| Unrelated Reject | `unrelated: 0` throughout automatic runs |

With the popup switch **off**, direct and late fixtures must remain untouched and the count must stay fixed. Insert a direct fixture while off, then switch on: it should be rejected once and count once. Reopen the popup and relaunch Safari to check the saved switch and count persist. Also queue a banner, switch off before five seconds, and confirm it remains when inserted. Watch for storage/background errors and duplicate counts.

For history restoration, insert and reject a direct fixture, navigate via the page's link, switch off on the away page, then use Safari Back. Confirm `pageshowPersisted: true` before calling this a bfcache test; if false, record a normal navigation and retry. Insert a new fixture on the restored page: it must remain with the switch off. Enable again: it should reject and count once. Repeat with the switch left on throughout. A restored previously completed fixture must not increment the count again.

After these checks, use a few known supported live sites from [coverage](COVERAGE.md). Record exact URLs, consent manager/layout, device, OS, permissions and outcome; fixtures do not establish live-site coverage or tracking compliance. Unknown layouts should remain for manual handling.

## Evidence to return

Return commit SHA; Xcode/macOS/iOS versions; scheme and destination; packager/build warnings; installation/permission steps; fixture results and popup count deltas; portrait/landscape popup screenshots; and remaining blockers. Label simulator and physical results separately. Node, jsdom and Playwright WebKit checks do not prove iOS extension installation or native popup behaviour. Avoid claiming a signing, App Store or TestFlight release from a local test.

## Kickoff prompt for the MacminiM4 session

> Continue Quiet Exit on branch `codex/initial-extension`. Read applicable AGENTS.md instructions, README.md and docs/IOS-TESTING.md. Preserve existing changes and native Xcode settings. Confirm the repository commit and Xcode versions, run the documented checks, generate or reuse the Safari wrapper, and test the containing iOS app first on iPhone and iPad simulators. Use the manual fixture server and report rejection, fail-closed preferences, late banners, saved switch, count deltas and confirmed bfcache restoration. Attempt physical-device testing only with the user's existing authorised development setup; return any signing/account blocker precisely. Do not publish, archive for distribution or upload to stores. Capture warnings, screenshots and actual device results; distinguish them from DOM-only checks.
