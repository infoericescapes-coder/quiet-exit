# Bundled assets

All assets are local at runtime. No asset request leaves the extension.

- `ee-monogram-white.svg` is the unchanged Eric Escapes original from https://www.ericescapes.com/brand/logos/ee-monogram-white.svg.
- `monogram-white-512.png` is the unchanged original raster from https://www.ericescapes.com/brand/logos/png/monogram-white-512.png. Source SHA-256: `7c8a117b579dfff3dc0a87abee4bb63f1afaa31cf1be68fed58571d0328e7432`.
- `icon-{16,32,48,128}.png` use that original raster, uniformly scaled to one third of each canvas width and centred on the brand canvas colour #050605. This retains at least one mark width of clear space on all sides. Pillow LANCZOS resizing was used; the mark was not redrawn or recoloured.
- `fonts/space-grotesk.ttf` is the variable Space Grotesk font from https://github.com/google/fonts/blob/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf.
- `fonts/ibm-plex-mono.ttf` is IBM Plex Mono Regular from https://github.com/google/fonts/blob/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf.
- Both fonts are under the SIL Open Font License. Their licence text is alongside them, with line endings and trailing whitespace normalised.
