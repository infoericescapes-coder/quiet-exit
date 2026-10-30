# Foundation handoff: Quiet Exit 0.1.3

Updated 31 October 2026 (Australia/Sydney). Start here for the current native iOS test work. The goal is to build and exercise the **installed Safari extension** on iPhone and iPad, record fresh evidence, and resolve any reproduced defects without weakening the refusal contract.

## Start from the latest work

- Repository: [infoericescapes-coder/quiet-exit](https://github.com/infoericescapes-coder/quiet-exit).
- Current app branch: **`codex/initial-extension`**. [PR #2](https://github.com/infoericescapes-coder/quiet-exit/pull/2) merged the reviewed hardening, Xcode 27 fixes and current native evidence at `21f1d4f0eba5feab06fe039e08cae6e8a6b398f2`. Its tree is identical to tested feature head `e43452fd1f2192b395f00b99a20c47de14a7c317`.
- The current simulator test run started at `20d4f1897902aa4e086510409814ea7af6b1f498`, with the reviewed Xcode 27 packaging/release-preflight fixes described in the dated report. Consent scripts were unchanged. Fetch the latest branch and record the actual SHA used for testing; inspect current PR state before merging.
- [PR #1](https://github.com/infoericescapes-coder/quiet-exit/pull/1) from the app branch to `main` remains open and draft with the physical-device/public-release hold. This was verified after PR #2 merged. Recheck live state before a further merge.

Read [AGENTS.md](AGENTS.md), [README.md](README.md), [coverage](docs/COVERAGE.md), the [30 October integration report](docs/CONSENT-HARDENING-2026-10-30.md), and the [native iOS procedure](docs/IOS-TESTING.md). The latter opens with **historical 0.1.2 results**; use its procedure while testing current 0.1.3 source afresh.

For a fresh checkout, choose an unused destination:

```sh
git clone --branch codex/initial-extension https://github.com/infoericescapes-coder/quiet-exit.git quiet-exit
cd quiet-exit
git status --short
git rev-parse HEAD
```

For an existing checkout, inspect its branch, changes and native project before fetching and switching to the current app branch. Preserve local work. `safari/`, `dist/` and `artifacts/` are ignored: a clean Git status does not mean the existing native wrapper or signing configuration is disposable, and a fresh clone will not contain them.

## What has passed

The table below records the **30 October checks**, not the latest native run. Those results apply to the reviewed 0.1.3 source introduced in `73d29ee10b4492cfad82107312f3794189f8ad26`, unchanged in `7d8549e`. Re-run applicable checks after any source change.

| Verification | Observed result | Scope |
| --- | --- | --- |
| Independent checks and primary final rerun | `npm run check` and `npm run package` exited 0; **105/105 unit tests** | Includes existing browser/popup checks and packaging |
| Consent regressions | **42/42**: 19 Chromium, 19 Playwright WebKit, four loaded Chromium-package cases | Synthetic fixtures; WebKit does not establish native Safari extension integration |
| Negative controls | Two isolated defect injections each failed the intended regression test | Wording guard and known-cookie-outcome guard; production source was preserved |
| Package inspection | Chrome/Safari sources and ZIP contents matched the reviewed source | Safari ZIP contains web resources, not an installable Apple app |
| Independent review | No remaining functional blocker in the scoped change | Separate implementation, behavioural verification and review |
| Native macOS Safari 27.2 page engine | **16/16** in a fresh private window; zero acceptance clicks, meaningful direct/preferences positives, disabled control | Ordinary page scripts, not an installed extension; Best Lawyers was excluded |
| GitHub CI at `7d8549e` | [PR run](https://github.com/infoericescapes-coder/quiet-exit/actions/runs/40972451899) and [push run](https://github.com/infoericescapes-coder/quiet-exit/actions/runs/40972446245) passed | Inspect current-head checks separately after each push |

[Structured verification](docs/evidence/2026-10-30/verification.json), [42-case results](docs/evidence/2026-10-30/consent-pattern-results.json), and [native page-engine evidence/replay](docs/evidence/2026-10-30/NATIVE-SAFARI-ENGINE.md) are committed. The first ordinary-window native run is retained as **15/16**: an acceptance occurred during the no-engine baseline for `drifted-manage`, so Quiet Exit was never started for that case. Its cause was not attributed to a specific extension. The unchanged harness passed all baselines and active checks in the private window.

**Fresh installed 0.1.3 simulator testing is now available:** [31 October report](docs/IOS-TEST-RESULTS-2026-10-31.md) and [evidence/replay](docs/evidence/2026-10-31/README.md). Xcode 27.2 built and installed app/extension 0.1.3 (1) on iPhone 18 Pro and iPhone Duo, both simulated iOS 27.2. Each passed the 26-case off baseline and enabled matrix, with zero acceptance/other/unrelated actions and popup 0 → 3. Both passed pause-before-queue, resume, genuine bfcache and Safari restart persistence checks. Initial inconclusive/operator-invalid attempts are retained alongside valid repeats. The latest integrated suite has 124 unit tests plus browser/popup and 42 consent cases.

On Duo, live Best Lawyers notice removal and popup 7 → 8 were corroborated by a native persisted `bl_cookie_policy_V4=0`, unchanged after reload while paused. Independent page-visible cookie inspection remains outstanding; see the precise evidence boundary in the report. Physical iPhone/iPad and current iPad simulator coverage remain untested.

The earlier macOS temporary-loading attempt was cancelled at local Touch ID/password authentication; Allow unsigned extensions remained off. That historical blocker is separate from the successful installed iOS simulator testing. Full Xcode is now installed on this preparation Mac.

## What the change does

Known selectors now require trustworthy rejection/manage/save wording. Accepting, neutral, contradictory, formatted or opaque actions are left untouched. Observable replacement preference surfaces prevent false completion. The Best Lawyers rule is limited to its exact bare/www hostnames and essential-only controls; it also requires one exact `bl_cookie_policy_V4=0` value after interface disappearance before counting.

Preserve these boundaries: English support, Chrome/Safari only, complete optional-off inventory before saving, and no accept-all fallback. Do not add Super Agent code, downloaded executable rules, analytics, cookie writes or page-SDK consent calls. A generic count proves a deliberate refusal followed by interface disappearance, not universally verified stored consent or stopped tracking. See the integration report for the source observations and coverage tradeoffs.

## Prepare the native build

Use a Mac with Node.js 22+, full Xcode and available iPhone/iPad simulator runtimes. Record the real environment rather than assuming the historical versions:

```sh
node --version
xcode-select -p
xcodebuild -version
npm ci
npx playwright install chromium webkit
npm run check
npm run package
```

For a **new** native wrapper, run `npm run safari`. It builds the resources, generates `safari/`, stamps the package version and populates icons. It deliberately refuses to replace an existing `safari/` directory.

For an **existing** wrapper, preserve native edits, team, bundle identifiers and signing settings. Rebuild web resources with `npm run build`, then rebuild the containing iOS app in Xcode. Check the project's resource references point to this checkout's current `dist/safari`; an older checkout's resources must not slip into the build. Fresh-generation version stamping does not update a reused wrapper: ensure both app and extension report **0.1.3**, record their build numbers, and compare bundled web resources with `dist/safari` before testing.

The historical project was `safari/Quiet Exit/Quiet Exit.xcodeproj`, scheme `Quiet Exit (iOS)`, with app `com.ericescapes.quietexit` and extension `com.ericescapes.quietexit.Extension`. Discover and verify the actual local project/schemes. Run the **containing iOS app**, then enable its embedded Safari extension and grant the fixture host access. Follow [IOS-TESTING.md](docs/IOS-TESTING.md) for native setup and reuse details.

## Remaining iOS test work

The two requested iPhone simulators have now been exercised. Continue the real installed 0.1.3 matrix on an iPad simulator and available physical iPhone/iPad devices; repeat affected cases if product source changes. Keep simulator and physical results separate. Device trust, signing, Developer Mode or unlock blockers should be recorded precisely; they are not test passes.

Start the fixture server in a separate terminal:

```sh
node scripts/manual-fixtures.mjs --port=8765
```

Open `http://127.0.0.1:8765/` in simulator Safari. For a physical device on the same Wi-Fi, use `node scripts/manual-fixtures.mjs --lan --port=8765` and the Mac's verified LAN address instead of `127.0.0.1`. Pick another port if occupied. This server supplies fixtures and fonts only; it does **not** inject Quiet Exit's engine. The installed extension must supply the behaviour.

| Test | Required evidence |
| --- | --- |
| Installation and identity | Containing app and embedded extension build/install/launch; version 0.1.3, recorded build and matching resources; explicit fixture-host permission |
| Popup and icons | Visible application/toolbar icons, readable popup and branded footer in portrait/landscape; switch and count accessible |
| Off/on positive control | With Quiet Exit off, fixture remains untouched and count stays fixed; enabling causes exactly one deliberate refusal and count +1 |
| Direct and late rejection | One rejection, zero acceptance/unrelated clicks, interface disappearance, count +1; repeat after five-second insertion |
| Complete Cookiebot preferences | Three optional clicks, one save, Necessary true and Preferences/Statistics/Marketing false, count +1 |
| Existing negative matrix | Unknown, unreadable, disabled-on, hidden and missing optional controls; vendors, legitimate interest and collapsed sections: no save/count increase; inspect actual controls and click evidence |
| Stuck/replacement interfaces | Bounded deliberate rejection attempts; no count for a remaining banner or incomplete replacement preferences; observe stuck rejection for at least 12 seconds |
| New action regressions | Acceptance/subscription, drifted reject/manage/save wording, contradictory labels, opacity-hidden/native-associated/generated wording, opaque action/replacement and shadow-only fixtures: expected no-action or uncounted deliberate refusal as detailed below |
| Pause timing and persistence | Queue a banner while enabled, then disable **before** insertion; no action/count. Verify paused state and count after Safari restart; resume a pending banner once |
| Back/forward cache | Require `pageshowPersisted: true` before claiming bfcache coverage; test off/resume and enabled restoration without duplicate counting on both device classes |
| Controlled live sites | Record exact URL/layout/device/permissions, clean consent context and actual outcome. Unknown/drifted layouts remain available for manual handling |

For the new regressions, visit `/patterns?case=NAME` on the fixture server. The cases are `frandroid-accept-only`, `telerama-accept-only`, `drifted-reject`, `drifted-manage`, `drifted-save`, `conflicting-label`, `neutral-notice`, `opacity-label`, `associated-label`, `generated-label`, `opaque-action`, `opaque-replacement` and `shadow-only`. Require acceptance/other-action counts to stay zero and no popup-count increase. `opaque-replacement` may perform a bounded deliberate rejection but must leave the replacement unresolved and uncounted; other listed cases must not reject. For `drifted-save`, optional controls must remain unchanged and unsaved.

Reload between cases, compare popup **count deltas**, and do not manually press the consent buttons while measuring automatic actions. Establish off-state controls and watch for interference: a fixture changing while Quiet Exit is disabled invalidates that baseline. Preserve the failed evidence and isolate the context before assigning a cause.

**Best Lawyers has a scoped live result in the 31 October report; its independent page-visible check still requires a controlled live test** on `https://www.bestlawyers.com/` or the exact bare hostname. Localhost `best-*` pages cannot validate the hostname-bound native adapter. With a fresh consent context and an observed supported notice, record the exact essential-only control, automatic action, stable notice disappearance, one exact page-visible `bl_cookie_policy_V4=0` value and count +1; verify persistence after reload. A missing notice, stale consent, changed markup or inaccessible value is unexercised/inconclusive, not a pass. A visible replacement dialog, missing/accepting/ambiguous cookie outcome or accepting click must not count as successful refusal. Do not weaken the action guards to force a changed site through the test.

## Historical evidence and release boundary

[3 October results](docs/IOS-TEST-RESULTS-2026-10-03.md) concern **0.1.2**: native simulator build/install/popup/refusal/preferences/persistence checks passed, and iPhone bfcache checks passed. Disable-during-queue timing was inconclusive; the full native negative matrix was incomplete. Physical iPhone installation succeeded but launch was blocked by a locked device; physical Safari behaviour was not verified, and physical iPad was untested.

App Store Connect access from this Mac was verified with HTTP 200 for app `6818695484`, bundle `com.ericescapes.quietexit`; build 2 (0.1.3) is now `VALID`, unexpired and available in the existing internal TestFlight group; build 1 remains present. Eric explicitly authorised a new TestFlight build **from this MacBook Air after testing**, superseding Foundation's original Mac-mini-only upload restriction. The existing distribution key was supplied locally and matched the pinned certificate; existing per-bundle App Store profiles were verified. No keys belong in Git or chat. Follow the reviewed disposable-keychain release script and require fresh ASC version/build/processing readback before reporting success. Record the actual release outcome separately; an unused build number must be checked at execution.

Keep the physical-device/public-release hold. PR #2 was merged after independent review, the installed iPhone simulator checks and both current-head GitHub checks passed. PR #1 remains the separate draft to `main`. Inspect current-head CI/reviews and Eric's instructions before any further merge. This document does not itself grant publication authority or waive the remaining device checks.

## Workflow and return report

Follow Foundation's applicable operating instructions alongside the repository contract, preserving independent implementation, behavioural verification and final review. Report actual instruction conflicts instead of silently replacing either workflow. Hyper Send was installed in the originating Codex environment; it is not bundled in Git and should not be assumed installed on Foundation's host. The native procedures here do not require it.

Return a dated report with the tested commit/dirty status, Xcode/macOS/iOS versions, scheme/destination, app/extension versions and resource identity, permission/setup steps, per-case observed states and count deltas, screenshots/logs, fixes and their rechecks, and unresolved blockers. Distinguish automated engine, loaded Chrome package, native Safari page engine, installed simulator extension and physical-device evidence. Link the report from this handoff, inspect CI/reviews for the final pushed head, and stop task-owned fixture servers afterward.

## Local TestFlight release

See [31 October release record](docs/TESTFLIGHT-2026-10-31.md) for the actual upload state and next steps. The first 0.1.3 (2) upload was rejected under Xcode 27.2 (27B52). The separate Xcode 27.1 build passed bounded installed-simulator upgrade/refusal checks and is now **VALID / IN_BETA_TESTING** as 0.1.3 (2), assigned to **Eric Internal Testing** with What-to-Test instructions. Foundation can start physical-device checks from this build; build 2 is used and must not be uploaded again. The global Xcode 27.2 installation remains selected. Follow the linked release record for exact identifiers, readbacks, signing audit and cleanup.
