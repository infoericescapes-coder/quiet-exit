# Consent outcome hardening, 30 October 2026

This change applies findings from a controlled inspection of Super Agent 4.7.2 to Quiet Exit 0.1.3. It preserves Quiet Exit's refusal-only behaviour and does not import Super Agent's implementation or remote rule database.

## Observations that motivated the change

Super Agent's installed Safari cache matched its production download: 1,159 rules, canonical SHA-256 `a825e5884841aeefd653c88055e15d5c842bbaad704253131d891633ff9644f5`. Of 496 modern rules, 52 selected an `accept_all` branch when all four optional categories were Reject. These were branch classifications, not 52 verified consent grants.

Controlled native Safari visits established three real consent grants under those Reject settings:

| Site | Observed result | Quiet Exit implication |
| --- | --- | --- |
| Best Lawyers | Its acceptance button established `bl_cookie_policy_V4=1`; essential-only establishes `0` | Use the exact essential-only control and verify `0` after disappearance |
| Frandroid | Didomi changed from no enabled purposes to 14 enabled purposes and 176 enabled vendors | An accept/subscription interface must not become a refusal fallback |
| Télérama | All five optional purpose flags became true; analytics mode changed from `exempt` to `optin` | Consent state is stronger evidence than a hidden banner or action label |
| Music Mark | Target absent, zero extension clicks, no readable analytics choice | Missing targets are inconclusive, not successful refusal |
| teltarif | Matching class existed inside a shadow root and labelled withdrawal in the inspected settings view; zero extension clicks | Selectors and their meanings drift; unknown surfaces remain untouched |

These observations do not establish that trackers subsequently transmitted data. Public site behaviour can change. Fixtures here reproduce only the relevant interaction shapes, not an entire third-party consent manager or production website.

## Changes in Quiet Exit

The previous application commit, `c3e696e`, was independently reproduced clicking a familiar reject selector labelled `Accepter et continuer`, then recording completion. It also recorded completion when a reject handler replaced its content with a custom preferences host. Both probes produced one click and one completion; [the baseline record](evidence/2026-10-30/prechange-baseline.json) preserves those results.

Every rejection, management and save action now needs positive supported wording. IDs/classes identify candidates but cannot authorise accepting, neutral or contradictory wording. The deliberately bounded action contract admits plain native buttons, links and button inputs. Formatted/icon controls, element descendants, custom hosts and externally referenced names are skipped when their full meaning cannot be established. This reduces coverage in favour of leaving uncertain controls for the user.

Best Lawyers has a bundled adapter limited to `bestlawyers.com` and `www.bestlawyers.com`, its exact consent-notice scope, exact desktop/mobile essential-only IDs and exact wording. It reads the known consent marker locally after the action, and records completion only when a single exact `bl_cookie_policy_V4=0` value and interface disappearance remain observed. Missing, ambiguous or accepting values do not qualify. Strict action selection cannot fall through to a generic click, and remaining recognised preferences interfaces block completion.

Observable shadow roots, custom hosts and declarative shadow templates remain unresolved interface content. This is not broad shadow-DOM support. Closed roots on ordinary native mounts can be unobservable; generic completion remains evidence of a deliberate refusal action plus interface disappearance, not universally verified stored consent.

The privacy notice describes the narrow consent-cookie read. No cookie writes/deletion, page-SDK consent calls, remote rules, analytics, new permissions or Firefox target were added.

## Combined workflow

`AGENTS.md` records the refusal contract, scoped multi-agent packages, independent behavioural verification and separate diff review, source/fixture/native evidence distinctions and actual repository gates. It refers to the installed operating model for model routing rather than maintaining a conflicting second table.

Eric's supplied Hyper Send skill was adapted and installed separately in Codex's personal skills folder. The original supplied file was preserved. The adaptation adds explicit Codex helper routing, ownership and independent gates, PR attachment, current-head CI/review handling and accurate handoff states. Its explicit user-authority requirement for merging remains intact. Codex's skill-format validator passed; this was compatibility validation, not a separate security audit of the supplied skill.

## Verification record

Implementation smoke tests passed after independent review identified and the builder repaired hidden accessible wording, opaque action controls, native associated labels, generated wording and replacement-dialog completion cases. The final independent diff review found no functional blockers. A nonblocking fixture-font issue was corrected and included in the primary gate rerun.

The new `npm run test:consent` gate runs original synthetic fixtures in Chromium and WebKit and loads the real Chromium extension package for selected cases. It verifies positive essential-only outcomes, zero acceptance-button clicks and zero false completion in negative cases. A deliberately broken essential-only handler grants consent anyway; its accepting state must remain unconfirmed, illustrating that a site can misimplement a labelled choice. Other accept-only and ambiguous fixtures retain their initial optional-consent state. Network interception serves local fixtures at test URLs; the harness does not contact the named production sites. Results include source hashes in `artifacts/consent-pattern-results.json` and CI uploads the artifacts.

`scripts/manual-fixtures.mjs` also exposes research-regression pages for native Safari testing. A localhost fixture cannot exercise the hostname-bound Best Lawyers adapter; that needs either the isolated intercepted browser harness or a separately controlled real-site visit.

Independent `npm run check` and `npm run package` both exited 0: **105 unit tests**, existing browser/popup/package checks, and **42 consent-pattern cases** (19 Chromium, 19 WebKit, four loaded Chromium package cases). Two isolated defect injections, bypassing the wording guard and the cookie-outcome guard, each caused the intended regression test to fail with exit 1. Generated Chrome/Safari sources and ZIP contents matched the checked source. These checks exercised a modified working tree based on `c3e696e`, identified by source hashes; they do not describe the unmodified base commit. [Verification evidence](evidence/2026-10-30/verification.json) records the distinction.

The primary reran the full check and packaging after review and the fixture-font correction: both exited 0, with the same 105 unit tests and all 42 consent cases passing. The primary also compared both ZIP manifests and engine/platform bytes to the checked source. [Detailed consent-pattern outcomes](evidence/2026-10-30/consent-pattern-results.json) include source identities and each observed state.

**Installed Safari extension status:** temporary loading was authorised, but Safari requires local Touch ID/password authentication that was unavailable while the user was away. The prompt was cancelled and **Allow unsigned extensions** was verified off. The new version has not been installed or exercised as a native Safari extension. This host has Command Line Tools and no full Xcode installation; alternate-host readiness could not be established.

**Native Safari page-engine fallback:** the unchanged reviewed engine was served as ordinary scripts in local synthetic pages and exercised through the actual Safari 27.2 (22625.2.8.11.9) UI. A fresh private window passed all **16 cases**, including three-second untouched baselines, direct refusal, complete preferences with all three optional categories off, disabled operation and 13 negative consent patterns. Every case recorded zero acceptance clicks. This verifies page-engine behaviour in that Safari configuration, not extension installation, isolated-world execution, permissions, messaging, popup or persistent counting. The hostname-bound Best Lawyers cases were excluded; no live-site outcome is claimed.

The first ordinary-window run passed 15/16: `drifted-manage` recorded an acceptance during the no-engine baseline, so the harness refused to start Quiet Exit for that case. This is observed external interference, not an attributed finding against a particular extension. The failed run was retained; the same harness passed every baseline and active check in the private window. [Native fallback evidence and replay instructions](evidence/2026-10-30/NATIVE-SAFARI-ENGINE.md) preserve both outcomes and the exact harness.

Version 0.1.3 has not been uploaded to TestFlight or the App Store. Historical 0.1.2 native and distribution results remain historical; physical-device verification and the existing draft release hold are unchanged. GitHub CI status is attached to the current PR head and must be checked separately before an authorised merge.
