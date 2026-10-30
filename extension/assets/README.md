# Bundled assets

All assets are local at runtime. No asset request leaves the extension.

- `ee-monogram-white.svg` is the unchanged Eric Escapes original from https://www.ericescapes.com/brand/logos/ee-monogram-white.svg.
- `monogram-white-512.png` is the unchanged original raster from https://www.ericescapes.com/brand/logos/png/monogram-white-512.png. Source SHA-256: `7c8a117b579dfff3dc0a87abee4bb63f1afaa31cf1be68fed58571d0328e7432`.
- `icon-*.png` are the Quiet Exit product mark: a bitten cookie with a refusal slash, in #f2efe6 and #5fb53c on #050605. This is separate from the unchanged Eric Escapes attribution mark.
- `toolbar-safari-*.png` are monochrome transparent glyphs for Safari tinting. `toolbar-chrome-*.png` use brand green on transparency, readable against both light and dark browser chrome. Neither toolbar set has an opaque background.
- The glyph is adapted from Tabler's MIT-licensed `cookie-off` at v3.34.1. Original paths and licence are in `design/icons/`; the licence also ships as `assets/TABLER-LICENSE`; the slash receives a background knockout and brand green in the app icon. `npm run icons` regenerates all PNGs with Sharp, including the opaque 1024px Apple app master. Source: https://github.com/tabler/tabler-icons/blob/v3.34.1/icons/outline/cookie-off.svg.
- `fonts/space-grotesk.ttf` is the variable Space Grotesk font from https://github.com/google/fonts/blob/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf.
- `fonts/ibm-plex-mono.ttf` is IBM Plex Mono Regular from https://github.com/google/fonts/blob/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf.
- Both fonts are under the SIL Open Font License. Their licence text is alongside them, with line endings and trailing whitespace normalised.
