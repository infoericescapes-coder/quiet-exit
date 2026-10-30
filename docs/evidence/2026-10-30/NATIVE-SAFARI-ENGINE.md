# Native Safari page-engine evidence

The reviewed source at `73d29ee10b4492cfad82107312f3794189f8ad26` was exercised in the actual Safari 27.2 (22625.2.8.11.9) UI. These are ordinary page-script tests on loopback, not installed-extension tests.

- [Normal-window result](native-safari-engine-normal-profile.json): 15/16 passed. The `drifted-manage` no-engine baseline recorded one acceptance and optional consent before Quiet Exit started. Its active phase was intentionally not run. No responsible extension was identified.
- [Private-window result](native-safari-engine-private.json): 16/16 passed, from 2026-10-29 23:15:45.610 UTC to 23:17:22.030 UTC. All untouched baselines passed. All acceptance counts remained zero. Direct refusal and complete optional-off preferences each produced exactly one completion event; negative cases and the disabled control produced none.
- [Exact harness](native-safari-engine-harness.mjs): SHA-256 `87d4ebbce1de2ce6fde812eee61d576336d9849266ba075e0141c76cf537c199`. A separate reviewer inspected its source loading, assertions, failure reporting and bounded result writer before the successful run.

The harness serves fixed local resources and runs each case in a visible iframe, with a three-second no-engine baseline and three-second active observation. Source, fixture, font and harness hashes are recorded in each result. Baseline failures fail the case; they are never skipped or treated as success.

To replay this preserved harness from the repository root, copy it to its original relative location and start its loopback server:

```sh
mkdir -p artifacts
cp docs/evidence/2026-10-30/native-safari-engine-harness.mjs artifacts/native-safari-engine-harness.mjs
node artifacts/native-safari-engine-harness.mjs --port 8766
```

Open `http://127.0.0.1:8766/` in Safari and select **Start local page-engine checks**. The page reports PASS or FAIL and saves `artifacts/native-safari-engine-results.json`. Check fresh timestamps and source hashes rather than reusing historical results. Stop the server with Control-C afterward. Replaying against changed application source records that new source's hashes; it does not reproduce the historical source identity above.

This does not test extension installation, isolated-world execution, permissions, content-script messaging, popup, persistent counters, physical iOS devices or live-site behaviour. Best Lawyers is intentionally excluded because its rule requires the real hostname. Passing baselines bound observable interference; they do not prove that no other extensions exist. The Safari unsigned-extension setting remained off, and no extension settings were changed for this fallback.
