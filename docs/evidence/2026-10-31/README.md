# Native iOS evidence instruments, 31 October 2026

This folder preserves the local test instruments and evidence from two simulators: iPhone 18 Pro and iPhone Duo. It contains four matrix reports, 42 lifecycle event files, three scoped Best Lawyers cookie reads, a read-only cookie helper and 25 selected native screenshots. Instruments, helper source, captured JSON and PNG files are byte-for-byte copies from `artifacts/ios-2026-10-31/`; `capture-metadata.json` is a packaging-time inventory. The primary owns the separate native results report and the interpretation of popup and device observations. UTC timestamps in the JSON fall on 30 October; the local run date in Australia/Sydney is 31 October.

The instrument pages exercise the actual installed Safari extension against local synthetic interfaces. They never inject the product engine, mock extension APIs, write extension storage or cookies, or call a consent SDK. A separate scoped live Best Lawyers observation is documented below. The instruments do not establish which package is installed, whether a permission was granted, the native switch state or the actual popup count. Those require separate native observations. Source hashes identify the local reference files, not installed bundle identity.

## Replay from a fresh artifact directory

Use the corresponding repository source and Node.js 22 or later. Start with a fresh checkout or an absent artifact directory. If that directory already contains evidence or running instruments, preserve it and use a separate checkout. The instruments must be copied unchanged into the exact location below: relative fixture imports, root resolution, self-hashes and output paths depend on it. Do not run the committed copies directly from this evidence folder.

```sh
mkdir -p artifacts/ios-2026-10-31
cp docs/evidence/2026-10-31/native-installed-harness.mjs artifacts/ios-2026-10-31/native-installed-harness.mjs
cp docs/evidence/2026-10-31/native-lifecycle-harness.mjs artifacts/ios-2026-10-31/native-lifecycle-harness.mjs
node artifacts/ios-2026-10-31/native-installed-harness.mjs --self-check
node artifacts/ios-2026-10-31/native-lifecycle-harness.mjs --self-check
```

In separate terminals from the repository root:

```sh
node scripts/manual-fixtures.mjs
node artifacts/ios-2026-10-31/native-installed-harness.mjs
node artifacts/ios-2026-10-31/native-lifecycle-harness.mjs
```

These bind only to `127.0.0.1` on ports 8765, 8767 and 8768. Port 8767 proxies the original manual page from port 8765 without rewriting its controls. The research pattern pages use the exact `consentPatternPage` output from the fixture source. No production site is contacted. Stop each server with Ctrl-C; saved JSON remains. The lifecycle read endpoint and matrix baseline index exist only for the current server process.

Install the intended native app and its embedded extension using the separate build procedure, enable it in Safari and grant access to the loopback host. Record native bundle identity, switch state and popup count independently. `build-identity.json` preserves the build inspection output: app and extension version 0.1.3, build 1, minimum iOS 15.4 and no recorded resource mismatches. It is not an installation receipt.

## Matrix on port 8767

Open `http://127.0.0.1:8767/?device=iphone18pro`, or use `http://127.0.0.1:8767/?device=iphone-duo`. Device labels identify evidence; they do not select an engine or assert a device identity. In the real native popup, switch Automatically decline off and record its count. Run **Run baseline: extension OFF** and leave the tab visible. Record the popup count again. Enable the real extension, record its count and run **Run enabled checks**. Each suite takes about two minutes. A passing OFF baseline for the same device label is required during the same port-8767 server lifetime; restarting the server requires a fresh baseline. The buttons never change the extension switch.

The 26 cases comprise:

| Group | Cases | Expected enabled behaviour |
| --- | --- | --- |
| 13 research patterns | `frandroid-accept-only`, `telerama-accept-only`, `drifted-reject`, `conflicting-label`, `neutral-notice`, `opaque-replacement`, `opaque-action`, `opacity-label`, `associated-label`, `generated-label`, `shadow-only`, `drifted-manage`, `drifted-save` | No acceptance, unrelated or other clicks, no save, optional consent remains false and no expected popup increment. `opaque-replacement` permits 1–3 reject clicks but requires its replacement and optional-on shadow control to remain. |
| 3 positive controls | `direct`, `preferences`, `late` | Each expects one popup increment. Direct and late require one rejection and removal. Cookiebot preferences require three optional clicks, one save, Necessary true and Preferences, Statistics and Marketing false. |
| 8 incomplete preferences | `unknown`, `indeterminate`, `disabled`, `hidden`, `missing`, `vendors`, `interest`, `collapsed` | No click or save, original inventory and optional-on states retained, interface remains. |
| 2 unresolved rejections | `failed`, `replacement` | 1–3 reject clicks permitted, interface remains unresolved and no expected popup increment. |

An OFF baseline requires zero consent clicks and intact initial states in every case. The positives detect an absent or non-running extension that zero-click negatives alone would miss. `opaque-replacement`, `failed` and `replacement` are observed for 12 seconds; most other cases for 3 seconds. The matrix `late` case inserts after 5 seconds and is observed for 8 seconds. Research pattern inputs are already rendered before frame load; manual fixtures are inserted through the original select/show controls after load. These are different insertion paths.

The aggregate expected popup delta is **0 while OFF** and **+3 while enabled**. JSON `expectedPopupDelta` values are expectations, not popup measurements. The primary's native observations supply the actual count comparison.

### Matrix JSON and limits

`installed-<device>-<mode>-<timestamp>-<runId>.json` contains `mode`, `device`, unique `runId`, the enabled run's `baselineRunId`, source SHA-256 values, timestamps, user agent, `complete`, `passed`, aggregate expected popup delta, per-case `results` and `errors`. Each result records its ID/type, duration, expected popup delta, page counters, input inventory/saved states, retained surface, failures and errors. Missing/blank states, wrong positive/negative outcomes, wrong case order, short observations and errors cannot produce a passing accepted report; the server recomputes checks from submitted snapshots. Writes are same-origin JSON, bounded to 128 KiB and use unique filenames.

The assertion text **“fixture and tab visible throughout observation” overstates the instrumentation**. It records top-document visibility changes during each case, checks final document visibility and final iframe style/geometry, and scrolls the frame/mount into view. It does not continuously prove that the entire frame or every control stayed on screen, unobscured or intersecting the viewport. In particular, iframe geometry is not continuous on-screen visibility proof. Fixture error listeners start after frame load, so early synchronous errors are not exhaustively captured. This instrumentation supplements native observations; it does not replace screenshots or prove physical-device behaviour.

The retained iPhone 18 Pro reports are:

- [OFF baseline](installed-iphone18pro-off-2026-10-30T15-46-36-608Z-4bd0e8fb-ed98-403f-8ec4-34789094722b.json), run `4bd0e8fb-ed98-403f-8ec4-34789094722b`.
- [Enabled matrix](installed-iphone18pro-enabled-2026-10-30T15-49-42-498Z-503fdeda-41fe-484a-8873-4dc4b084d3fc.json), run `503fdeda-41fe-484a-8873-4dc4b084d3fc`, linked to that baseline.

Both retained reports contain 26 results, `complete: true`, `passed: true` and no report errors. That is the recorded instrument verdict, with the limits above.

The retained iPhone Duo reports are:

- [OFF baseline](installed-iphone-duo-off-2026-10-30T16-14-12-544Z-82a54bcb-56ba-4729-b03c-ac9d36807344.json), run `82a54bcb-56ba-4729-b03c-ac9d36807344`.
- [Enabled matrix](installed-iphone-duo-enabled-2026-10-30T16-17-17-791Z-a7e21b1f-659e-460e-af7a-bab36294cf56.json), run `a7e21b1f-659e-460e-af7a-bab36294cf56`, linked to that baseline.

These also contain 26 results each, `complete: true`, `passed: true` and no report errors. Across two devices, the four reports therefore retain 104 case observations, comprising 52 OFF and 52 enabled observations.

## Lifecycle on port 8768

Open `http://127.0.0.1:8768/?device=iphone18pro` or `http://127.0.0.1:8768/?device=iphone-duo`. Entry without `run` generates a fresh run query; the Fresh run link obtains another. **Insert direct** inserts the exact original OneTrust fixture with real click handlers. **Queue direct in 30 seconds** gives the operator time to use the real native popup to pause before insertion; logs preserve queue time, due time, actual firing/insertion time and any rejection. This 30-second lifecycle queue tests an operator-controlled switch transition. It is distinct from the matrix's 5-second late positive.

Use **Away, then Safari Back** and the browser's actual Back control. The page never automates history. Real `pageshow` events record `persisted`; only a recorded `persisted: true` establishes bfcache restoration for that document. Documents have no `no-store` response header and no unload/pagehide listeners. Browser eligibility and restoration still depend on the actual run. The instrument never declares the extension paused or enabled.

Every `lifecycle-*.json` file is one immutable saved event with device/run/document/event IDs, numeric document-local `sequence`, event `at`, server `receivedAt`, `kind`, `persisted`, user agent, reference hashes and a state snapshot. Snapshots include counters, queue/due/insert timestamps, surface presence, document visibility, last pageshow state and navigation type. Sort by **device, run, documentId, numeric sequence**, using timestamps to relate different documents. Lexical filename order puts sequence 10 before sequence 2 and is not event order. `navigationType` may remain `navigate` after restoration; use the actual pageshow value for bfcache claims.

Poll `http://127.0.0.1:8768/events?device=<label>&run=<run>` to read saved events during that server process. Each same-origin keepalive POST is bounded to 16 KiB; a run accepts at most 500 events, with at most 100 run indexes in a process. A saved file and server receipt establish delivery; initiating a fetch alone does not. Restarting the server clears its read index, while event files remain on disk.

### Preserve the corrected history context

All **42 lifecycle JSON files** are retained: 22 for iPhone 18 Pro and 20 for iPhone Duo. The first iPhone 18 Pro history attempt is included. Run `555750e9-3ffa-4f81-b16a-0e4d3fa10022`, document `8dfeb760-d7bc-4b2a-a0b1-d24319d30e15`, contains the valid initial 30-second queue phase: sequence 3 queues, 4 fires, 5 inserts, 6 completes the queue and 7 records rejection after resumption. Its later history attempt used an invalid navigation sequence, including an operator Forward attempt instead of the intended Back workflow. The resulting non-resumption must not be labelled an extension defect or used as the corrected paused-history test. This does not invalidate its earlier queue evidence; its raw events are preserved unchanged.

The corrected history controls are in run `0ec33088-549e-42ba-8deb-020c61a70ad7`, document `4719e7c5-4431-4090-9b4e-89b8ad51759e` (files carry the `iphone18pro-reload-control` device label). Sequences 6 and 10 record real `pageshow` events with `persisted: true`; insertion/rejection events and the native screenshots provide the surrounding evidence. The separate native results report owns the switch/count interpretation and the corrected procedure.

### Duo queue timing and history evidence

The Duo lifecycle run is `a6ad3443-a3ce-4493-9f06-8ab2748ffe7e`, document `63d95fe2-6885-45ee-864d-d295007e7342`. Its first queue is sequence 3, due at `2026-10-30T16:18:41.192Z`. The original artifact modification time of `duo-queued-paused-count3.png` is `16:18:43.727319Z`, **2.535319 seconds after the deadline**. That screenshot cannot establish pause-before-deadline timing. Preserve this attempt as **timing-inconclusive only**; the retained paused state and later resumption/count-4 outcome remain separate valid native observations. The first attempt is not discarded or treated as an extension defect.

The repeat begins at sequence 8, due at `16:20:56.873Z`. `duo-repeat-before-due-paused-count4.png` has original artifact modification time `16:20:45.482938Z`, **11.390062 seconds before the deadline**. Sequences 9–11 record firing, insertion and queue completion with reject count 1 unchanged; the arrival screenshot retains count 4. Sequence 12 records rejection after resumption, with the native popup capture at count 5. Real bfcache restores occur at sequences 14 and 18 (`persisted: true`): the enabled insertion/rejection control advances the native count 5→6, and the paused/restored insertion remains until resumption advances it 6→7. These count/switch interpretations come from the primary's native observations and screenshots, not an automatic lifecycle verdict. The restart screenshot records the primary's post-stop/launch native observation of paused state and count 7; event files alone do not prove process termination or relaunch.

The iPhone 18 Pro before-deadline screenshot `iphone18-queued-paused-count3.png` is also retained. Its original artifact modification time is `15:50:58.430799Z`, **3.398201 seconds before** its queue deadline `15:51:01.829Z`. The after-arrival screenshot is a different capture and serves a different purpose.

## Screenshot time metadata

[capture-metadata.json](capture-metadata.json) inventories all 25 copied screenshots with byte length, SHA-256, original artifact path and the original artifact filesystem modification time in UTC and nanoseconds. These times were observed from the filesystem during packaging. They are **not camera capture timestamps, trusted-clock proof or exact native switch-transition timestamps**. Copying files into this evidence folder can give the copies different modification times, so use `originalArtifactMtimeUtc` when comparing these captures with queue deadlines. The timing differences above are arithmetic comparisons within that stated limitation.

## Scoped live Best Lawyers observation on Duo

This is an installed-extension positive observation on the actual `https://www.bestlawyers.com` site, separate from the local matrix. The primary independently viewed the initial notice and native popup, then enabled Quiet Exit without manually clicking a site consent button. The notice disappeared and the native count advanced **7→8**. The primary subsequently reloaded with Quiet Exit paused: the notice remained absent and the popup count remained **8**. The screenshots preserve the native before, paused, enabled and reloaded states. The no-manual-consent-click statement comes from the primary's tool/action observations, not a captured site click listener.

Three read-only native Safari disk snapshots corroborate the consent outcome:

| Observation | Scoped record result | Saved JSON |
| --- | --- | --- |
| Baseline, `16:32:26.062443Z` | No exact `bl_cookie_policy_V4` record on the three permitted Best Lawyers domains. | [Baseline](bestlawyers-duo-cookie-baseline-20261030T163226.062443Z.json) |
| After enable, `16:33:40.400478Z` | One record: `www.bestlawyers.com`, path `/`, value `0`. | [After enable](bestlawyers-duo-cookie-after-20261030T163340.400478Z.json) |
| After reload, `16:36:37.313768Z` | The same single domain/path/value-`0` record remains. | [After reload](bestlawyers-duo-cookie-after-20261030T163637.313768Z.json) |

The third file is the **after-reload observation**, despite the `after` filename/observation phase: the helper CLI accepts only `baseline` and `after`. This label does not imply the cookie was rewritten by reload; its source-file modification time predates the reload screenshot. All three reads record a stable file, valid page/record/string bounds and a matching documented page checksum. The present record's raw flags are `0x00004270`; documented Secure and HttpOnly bits are unset, with other bits retained without interpretation. No full cookie file or unrelated cookie values were copied or emitted.

The [read-only helper source](read-bestlawyers-native-cookie.py) is fixed to the authorised Duo Safari cookie file and the exact name/domain filter; it does not scan other containers. Its file layout is based on the [BinaryCookies parser documentation](https://github.com/interstateone/BinaryCookies#file-format) and [libyal Safari Cookies specification](https://github.com/libyal/dtformats/blob/main/documentation/Safari%20Cookies.asciidoc). To reproduce on this same simulator/container, copy the helper to the artifact directory and run it there:

```sh
cp docs/evidence/2026-10-31/read-bestlawyers-native-cookie.py artifacts/ios-2026-10-31/read-bestlawyers-native-cookie.py
python3 artifacts/ios-2026-10-31/read-bestlawyers-native-cookie.py --phase after
```

Each invocation writes a uniquely named scoped JSON observation beside the helper. The hard-coded source path is specific to this run, and may not exist on another machine or regenerated simulator. Running it later observes later disk state; it cannot recreate the original live visit. The initial baseline used the same filtering and bounds-checking method inline before the helper source was retained.

This establishes a native positive with independently read **persisted disk state absent→0→0 after reload**, within the captured visit. The extension's strict exact-host/page-visible-value completion gate was exercised indirectly through its count increment; **there was no independent page-JavaScript or Web Inspector `document.cookie` read**, and no independent live click-event listener. The disk read corroborates that postcondition rather than supplying inspector proof. Baseline absence is disk-snapshot absence and could omit unflushed live state. The outcome does not establish universal compatibility, a network-level refusal audit, server-side enforcement or prevention of all tracking.

## Selected native captures

The following 25 PNGs are copied unchanged. Their filenames label the captured scenario; read them alongside lifecycle events, capture metadata, scoped cookie reads and the primary's native results report.

| File | Captured scenario |
| --- | --- |
| [iphone18-queued-arrived-paused-count3.png](iphone18-queued-arrived-paused-count3.png) | Queued fixture arrived while paused, count 3. |
| [iphone18-queued-paused-count3.png](iphone18-queued-paused-count3.png) | Before-deadline paused capture, count 3. |
| [iphone18-resumed-count4.png](iphone18-resumed-count4.png) | Resumption after queue, count 4. |
| [iphone18-bfcache-on-new-count6.png](iphone18-bfcache-on-new-count6.png) | Enabled history control, count 6. |
| [iphone18-bfcache-corrected-paused-count6.png](iphone18-bfcache-corrected-paused-count6.png) | Corrected paused history control, count 6. |
| [iphone18-bfcache-corrected-resumed-count7.png](iphone18-bfcache-corrected-resumed-count7.png) | Corrected resumption, count 7. |
| [iphone18-restart-paused-count7.png](iphone18-restart-paused-count7.png) | Restart persistence while paused, count 7. |
| [iphone18-popup-portrait-full.png](iphone18-popup-portrait-full.png) | Full portrait popup. |
| [iphone18-popup-landscape-footer.png](iphone18-popup-landscape-footer.png) | Landscape popup footer. |
| [duo-after-baseline-count0.png](duo-after-baseline-count0.png) | Duo popup after OFF baseline, count 0. |
| [duo-after-enabled-count3.png](duo-after-enabled-count3.png) | Duo popup after enabled matrix, count 3. |
| [duo-queued-paused-count3.png](duo-queued-paused-count3.png) | First Duo paused capture, after the queue deadline; pause timing inconclusive. |
| [duo-resumed-count4.png](duo-resumed-count4.png) | First Duo queue resumption, count 4. |
| [duo-repeat-before-due-paused-count4.png](duo-repeat-before-due-paused-count4.png) | Repeat Duo paused capture before its deadline, count 4. |
| [duo-repeat-arrived-paused-count4.png](duo-repeat-arrived-paused-count4.png) | Repeat Duo fixture arrived while paused, count 4. |
| [duo-repeat-resumed-count5.png](duo-repeat-resumed-count5.png) | Repeat Duo resumption, count 5. |
| [duo-bfcache-on-count6.png](duo-bfcache-on-count6.png) | Duo enabled history control, count 6. |
| [duo-bfcache-paused-count6.png](duo-bfcache-paused-count6.png) | Duo paused history control, count 6. |
| [duo-bfcache-resumed-count7.png](duo-bfcache-resumed-count7.png) | Duo history resumption, count 7. |
| [duo-restart-paused-count7.png](duo-restart-paused-count7.png) | Duo post-restart paused state, count 7. |
| [duo-popup-inner-portrait.png](duo-popup-inner-portrait.png) | Duo inner-display portrait popup. |
| [duo-bestlawyers-before.png](duo-bestlawyers-before.png) | Live Best Lawyers initial notice. |
| [duo-bestlawyers-paused-count7.png](duo-bestlawyers-paused-count7.png) | Live Best Lawyers native paused baseline, count 7. |
| [duo-bestlawyers-enabled-count8.png](duo-bestlawyers-enabled-count8.png) | Live Best Lawyers enabled outcome, count 8. |
| [duo-bestlawyers-reload-paused-count8.png](duo-bestlawyers-reload-paused-count8.png) | Reloaded live page with extension paused, count 8 and notice absent. |

## Instrument self-check scope

The two committed instrument copies were replayed in an isolated temporary repository-shaped directory at their required artifact paths, with byte-identical reference fixtures, source files and fonts. Both `--self-check` commands exited 0. The matrix check covered browser-script syntax, exact pattern HTML, fonts, absent engine endpoint, missing baseline and invalid/cross-origin evidence rejection. The lifecycle check covered exact direct markup, browser-script syntax, fresh-run redirects, navigation documents without no-store, absent history automation/engine endpoint and rejected invalid/cross-origin events. These are implementer instrument checks, not independent verification and not new native tests. They wrote no result evidence and did not touch the running instruments.

## Separate Xcode 27.1 fallback smoke phase

[Xcode 27.1 / build-2 simulator smoke evidence](xcode27.1/README.md) preserves the later bounded upgrade/state/direct OFF→ON checks on both existing iOS 27.2 simulators. Its eight event files, nine screenshots, build identity and capture metadata are separate from this folder's original-phase counts and full SDK 27.2/build-1 suite. It does not claim a broad matrix or lifecycle rerun.

## TestFlight release receipt

The separate [release receipt](testflight-release.json) records the accepted Xcode 27.1 build 0.1.3 (2), internal-group and What-to-Test readbacks, signing summary and cleanup. It does not extend the original native test matrix to physical devices. See the [release report](../../TESTFLIGHT-2026-10-31.md).
