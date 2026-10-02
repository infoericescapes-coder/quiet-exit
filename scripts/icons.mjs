import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// Tabler cookie-off v3.34.1, MIT. Preserve its paths; style the refusal slash.
const root = new URL('../', import.meta.url);
const original = await readFile(new URL('design/icons/cookie-off.svg', root), 'utf8');
const paths = original.match(/<path[^>]+\/>/g).join('\n');
const slash = '<path d="M3 3l18 18" />';
function svg({ toolbar = false, chrome = false } = {}) {
  const ink = chrome ? '#5fb53c' : toolbar ? '#000000' : '#f2efe6';
  const styled = toolbar ? paths : paths.replace(slash,
    '<path d="M3 3l18 18" stroke="#050605" stroke-width="4.2" />' +
    '<path d="M3 3l18 18" stroke="#5fb53c" />');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 24 24">
    ${toolbar ? '' : '<rect width="24" height="24" fill="#050605"/>'}
    <g transform="${toolbar ? 'translate(0 0)' : 'translate(2.4 2.4) scale(.8)'}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${styled}</g>
  </svg>`;
}
const output = new URL('extension/assets/', root);
for (const size of [16, 32, 48, 64, 96, 128, 256, 512]) {
  await sharp(Buffer.from(svg())).resize(size, size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`, output)));
}
for (const size of [16, 19, 32, 38, 48]) {
  for (const browser of ['safari', 'chrome']) {
    await sharp(Buffer.from(svg({ toolbar: true, chrome: browser === 'chrome' }))).resize(size, size).png()
      .toFile(fileURLToPath(new URL(`toolbar-${browser}-${size}.png`, output)));
  }
}
await sharp(Buffer.from(svg())).resize(1024, 1024).removeAlpha().png()
  .toFile(fileURLToPath(new URL('design/icons/app-icon-1024.png', root)));
await writeFile(new URL('design/icons/quiet-exit.svg', root), svg() + '\n');
await mkdir(new URL('artifacts/', root), { recursive: true });
await sharp(Buffer.from(svg())).resize(512, 512).png().toFile(fileURLToPath(new URL('artifacts/icon-preview.png', root)));
console.log('Generated app icons and transparent Safari/Chrome toolbar glyphs.');
