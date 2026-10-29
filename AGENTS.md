# Quiet Exit development

Read `README.md`, `docs/COVERAGE.md` and the relevant tests before changing behaviour. Preserve existing user work. Chrome and Safari are the supported build targets; Firefox remains excluded.

## Consent contract

- Never accept optional cookies to remove a banner. An unknown, accept-only, subscription or ambiguous interface stays available for manual handling.
- A recognised selector is a locator, not permission to click. Require affirmative action wording and reject contradictory visible/accessibility labels.
- Save supported preferences only after a complete, inspectable inventory confirms every optional control is off. Opaque, incomplete or unknown layouts fail closed.
- Keep site-specific rules narrow and bundled. Do not import third-party extension code or a remote rule corpus. No analytics, remote executable rules, cookie writes or page-SDK consent calls.
- A click or disappearing banner does not prove stored refusal. Use a narrowly scoped, read-only consent postcondition when its meaning is established; describe other completion evidence accurately.
- Native Safari/iOS claims require fresh native evidence. Chromium/WebKit fixtures and historical device results have different scopes.

## Workflow

Use Hyper Send when available for end-to-end coding work. The primary reads the installed Codex operating model at `${CODEX_HOME:-$HOME/.codex}/operating-model/codex-multi-agent-loop.md` when present; that is the routing authority, not a duplicated model table in this repository. Follow actual higher-priority instructions and report conflicts.

Delegate substantive independent packages with explicit read/write ownership and checks. Workers are not alone and must preserve each other's edits. The implementer, behavioural verifier and final diff reviewer are separate roles; reviewers do not repair what they judge. The primary inspects their evidence and reruns decisive integrated checks. Children do not delegate. Keep shared build/package operations sequential.

For each package record expected behaviour, exact scope, baseline, regression and negative controls, commands/results and material limitations. After two unsuccessful repairs, reassess rather than weaken a gate.

The application currently lives on `codex/initial-extension` with draft PR #1; verify current refs before choosing a base. Changes to that app can use a focused PR targeting its development branch. The draft's physical-device release hold is not waived by a source-code test pass. Merging and distribution require their applicable user authority and gates; installing or invoking a skill does not authorise either by itself.

## Verification

Run from the repository root:

```sh
npm ci
npm run check
npm run package
```

Use narrower tests while implementing, then run the integrated gate on the reviewed tree. Inspect generated manifests/packages and ensure check scripts return failure for failed assertions. Add state assertions and known positive controls alongside zero-click negative cases. Record which checks use the real package, an injected DOM engine, native Safari or a device.

Preserve the existing Eric Escapes branding when changing product HTML. Functional consent fixtures model observed controls; do not restyle the product as part of a behaviour fix.
