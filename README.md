# Quiet Exit

**Cookie consent, declined.** By Eric Escapes.

Quiet Exit is a browser extension that declines supported cookie consent banners. It clicks a rejection control, or uses a supported preferences layout to turn optional choices off before saving. It never treats hiding a banner as consent rejection.

This repository contains the first development version. Site configurations vary, and no extension can safely promise to reject every banner. Unknown or ambiguous preferences are left for you to handle.

## Build and try it

Requires Node.js 22 or later and npm. No build dependencies run inside the extension.

```sh
npm ci
npm run build
```

### Chrome

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `dist/chrome`. Pin Quiet Exit, open its popup, and enable **Automatically decline**. Reload any tabs opened before installation. Allow site access where you want it to run.

### Safari on macOS, iPhone and iPad

The shared web extension source is in `dist/safari`. Safari installation also needs an Apple app wrapper:

```sh
npm run safari
```

This invokes Apple's Safari web extension packager (or its older converter name) to generate macOS and iOS targets. Full Xcode is required; Command Line Tools alone are insufficient. The script does not overwrite an existing `safari/` project.

Open the generated Xcode project, choose your signing team for its app and extension targets, and build the appropriate macOS or iOS target. The generated project references `dist/safari`, so rebuild the web files after edits. Enable the extension in Safari settings and grant website access. On iPhone and iPad, install the containing iOS app first, then enable its Safari extension. Distribution needs the relevant Apple signing and store workflow.

The generated Safari wrapper and containing app built, installed and launched on iPhone 17 Pro and iPad Pro 13-inch (M5) simulators running iOS 26.5. Native Safari fixture checks cover direct rejection, preferences, delayed banners, switch persistence and bfcache on iPhone, plus direct rejection, preferences and delayed banners on iPad. TestFlight version 0.1.2 (build 1) was uploaded on 3 October 2026 and verified for internal testing; physical-device behavior remains unverified. See the [iOS testing handoff](docs/IOS-TESTING.md) and the [3 October 2026 results](docs/IOS-TEST-RESULTS-2026-10-03.md).

See the [MacminiM4 iPhone/iPad testing handoff](docs/IOS-TESTING.md) for Xcode setup, manual fixtures and a reusable kickoff prompt.

The temporary unpacked extension has also been verified in native macOS Safari, including popup rendering, saved toggle state, automatic rejection of a local test banner and counting. If you already loaded `dist/safari` as a temporary extension, rebuild and use **Safari Settings → Extensions → Quiet Exit → Reload** to apply updates.

## Behaviour

- Direct rejection rules for common consent managers, with a conservative English fallback inside identifiable consent dialogs.
- Supported preferences flows open the panel, verify optional controls, turn them off and recheck before saving. Unsupported controls, unknown categories, vendor/legitimate-interest sections and incomplete layouts prevent saving.
- A debounced `MutationObserver` handles late banners. Attempts are bounded; disabling the extension stops pending work.
- The popup stores the enable switch and a local count. A count means a deliberate rejection action was followed by disappearance of that consent interface. It does not certify the site's server-side compliance or prove all tracking stopped.
- No accepting optional cookies, remote rules, analytics, cookies API, or network interception. Existing cookies are not erased. Essential cookies may still be used.

See [coverage and limitations](docs/COVERAGE.md) for the exact implementation scope and [privacy](PRIVACY.md) for permissions and storage.

## Verification

```sh
npx playwright install chromium webkit
npm run check
npm run package
```

`npm test` runs unit and adversarial fixture checks. `npm run test:browser` runs the DOM engine in Chromium and WebKit, then loads the real Chrome package to exercise content scripts, its service worker, local counting and the popup switch. Popup screenshots are written to `artifacts/` at narrow and wide viewport sizes. Firefox is outside the build scope.

`npm run package` writes browser ZIPs into `artifacts/`. The Safari ZIP contains web resources, not a signed installable Apple app. Store upload, signing and publication are separate release steps.

## Development

`extension/content/` owns detection and rejection. `extension/background.js` serialises aggregate counting. `extension/popup/` owns the local controls. `scripts/build.mjs` generates browser-specific manifests. New consent layouts should include positive rejection fixtures and negative controls proving that ambiguous states cannot be saved.

Fonts are bundled with their licences. Brand assets are from the [Eric Escapes brand kit](https://www.ericescapes.com/brand/). Their inclusion does not grant a separate licence to the Eric Escapes identity.

Platform references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [WebExtension background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), and [Apple Safari packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).
