# Quiet Exit TestFlight work, 31 October 2026

Eric explicitly authorised testing and TestFlight upload from this MacBook Air. This supersedes the original Foundation skill's Mac-mini-only build restriction. App Store review/public distribution remains separate.

## First attempt: Xcode 27.2

- Source: `e43452fd1f2192b395f00b99a20c47de14a7c317`, clean tracked tree. PR #2 subsequently merged at `21f1d4f0eba5feab06fe039e08cae6e8a6b398f2` with the same tree.
- Local checks: 124 unit tests, browser/popup checks, 42 consent regressions and packaging passed. [Push CI](https://github.com/infoericescapes-coder/quiet-exit/actions/runs/41092411460) and [PR CI](https://github.com/infoericescapes-coder/quiet-exit/actions/runs/41092422016) passed for that exact source head.
- Release: 0.1.3 (2), ASC app `6818695484`, app `com.ericescapes.quietexit`, extension `com.ericescapes.quietexit.Extension`.
- Archive and manual per-bundle App Store export succeeded. Independent inspection verified both signatures, the existing pinned distribution certificate, version/build, minimum iOS 15.4, non-exempt encryption false, and all 34 Safari resources byte-identical to the tested distribution.
- Exported metadata: Xcode 27.2 (`DTXcode=2720`, `DTXcodeBuild=27B52`), SDK `iphoneos27.2`, SDK build `24B8118`. The installed SDK reports the same build; no toolchain metadata was altered.
- Apple rejected the upload with **Unsupported SDK or Xcode version**, error ID `7TDHTI6J5VUWOOV36LQMLXDEPY`. The release script exited 70. A subsequent HTTP 200 ASC query found no build 2 record.
- Teardown was independently checked: the keychain search list exactly matched its pre-run value (login keychain only); no task disposable release-keychain or rsync-helper directories remained. The supplied private key was used in place, never moved or copied into the repository.

Apple lists Xcode 27.2 as current in its [system requirements](https://developer.apple.com/xcode/system-requirements/), and its authenticated download page identifies release 27B52. The actual upload rejection conflicts with that release availability. A server-side validation issue is possible but **not established**. Apple also documents accepted Xcode 27.1 RC and 27.2 RC uploads in its [ASC release notes](https://developer.apple.com/help/app-store-connect/release-notes/).

## Successful TestFlight release with Xcode 27.1

An official Xcode 27.1 (27A9275) download was expanded to `/Users/eric/Applications/QuietExit-Xcode-27.1/Xcode.app`. Gatekeeper accepted it as Apple System software and `xcodebuild -checkFirstLaunchStatus` returned 0. The original `/Applications/Xcode.app` remains installed and selected globally; each fallback build used an explicit `DEVELOPER_DIR`.

The fallback Debug build is 0.1.3 (2), built with simulator SDK 27.1 and installed on the existing **iOS 27.2** iPhone 18 Pro and Duo simulators. Both retained their paused settings and counters; an inserted direct banner stayed untouched while paused, then enabling produced exactly one rejection, zero acceptance, removal and count +1. Final states are iPhone **Paused / 8** and Duo **Paused / 9**. All 34 bundled Safari resources match the earlier tested distribution. See the independently inspected [bounded smoke evidence](evidence/2026-10-31/xcode27.1/README.md). This does not claim a repeat of the full matrix/lifecycle suite under SDK 27.1.

After a fresh ASC check found build 2 unused, the genuine 27.1 archive and manual export passed. Apple reported **Upload succeeded** at 2026-10-31 04:15:48 AEDT. ASC subsequently returned **VALID**, with marketing version 0.1.3, build 2, build ID `f8f9b88b-bdf5-4faf-aef2-ae2aa429122b`, uploaded date `2026-10-30T10:22:35-07:00` (17:22:35 UTC), unexpired and `APP_STORE_ELIGIBLE`. The parsed upload timestamp is later than this run's start. The script exited 0. Toolchain metadata was not spoofed. Source was merged commit `21f1d4f0eba5feab06fe039e08cae6e8a6b398f2`, with only documentation/evidence changes outstanding.

## Internal testing and cleanup

The existing **Eric Internal Testing** group (`12e7c642-44b1-4892-a39e-73d5f9e51b28`) was verified internal, with one existing tester. The existing `en-AU` What-to-Test localization (`3eef34a7-10bd-46cd-8a19-d5d2a398d0e2`) was updated with physical-device checks and read back byte-for-byte. Build 2 was added to that group; a fresh **group-side** read confirmed builds 2 and 1 both present and VALID. The build beta detail reports **IN_BETA_TESTING** internally and **READY_FOR_BETA_SUBMISSION** externally. No new testers, external groups or review submissions were created. This establishes internal TestFlight availability, not installation or notification delivery on a physical device.

A separate audit verified the exported app and extension distribution signatures against the pinned certificate, exact expected profiles, genuine arm64 iOS/SDK 27.1 metadata, version/build, minimum iOS 15.4 and non-exempt encryption false. All 34 Safari resources matched; all 58 extracted IPA files matched the ZIP and CRC checks passed. The automatic archive uses development signing; the manually exported IPA uses distribution signing. The IPA SHA-256 is `4ee32c9b9a37c6de67a1b36a21dbeef792779da957b0a8f85c64b6f39cde400e`.

The release script verified teardown, then the primary independently confirmed the current keychain search list equals both before/after records and no task signing-keychain or rsync-helper directories remain. Fixture ports 8765, 8767 and 8768 are closed. Both simulator extensions were left paused. A [sanitised release receipt](evidence/2026-10-31/testflight-release.json) records the ASC readbacks, identifiers, exact testing text and audit summary without keys, tester identity or authenticated logs.

Build 2 is now used. Future releases must check ASC and use a new build number; do not rerun this upload. The separate 27.1 toolchain was a successful workaround for this attempt, not a permanent version requirement or proof of the cause of the 27.2 rejection.

## Local artifacts and remaining testing

Ignored artifacts on the test Mac are under `artifacts/ios-2026-10-31/`, `artifacts/ios-release-0.1.3-2-20261030T164336Z-68511/` and `artifacts/ios-release-0.1.3-2-20261030T171406Z-73469/`: release log, independent release-identity JSON, rejected-attempt record, ASC readback, archive, IPA and keychain before/after observations. Do not commit credentials, keychain material or full authenticated distribution logs.

[Installed simulator report](IOS-TEST-RESULTS-2026-10-31.md) and [Foundation handoff](../FOUNDATION-HANDOFF.md) distinguish the successful iPhone 18 Pro/Duo checks from outstanding current iPad simulator, physical iPhone/iPad and independent page-visible Best Lawyers cookie checks. This release is confirmed available for internal TestFlight testing; the remaining device checks and public-release hold still apply.
