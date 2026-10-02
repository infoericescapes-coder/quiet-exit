import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const common = {
  manifest_version: 3,
  name: 'Quiet Exit — Cookie Refuser',
  short_name: 'Quiet Exit',
  version,
  description: 'Automatically declines supported cookie banners. By Eric Escapes.',
  homepage_url: 'https://github.com/infoericescapes-coder/quiet-exit',
  permissions: ['storage'],
  host_permissions: ['http://*/*', 'https://*/*'],
  action: { default_title: 'Quiet Exit', default_popup: 'popup/popup.html' },
  icons: Object.fromEntries([16, 32, 48, 128].map(size => [size, `assets/icon-${size}.png`])),
  content_scripts: [{
    matches: ['http://*/*', 'https://*/*'],
    js: ['content/platforms.js', 'content/engine.js', 'content/content.js'],
    run_at: 'document_idle',
    all_frames: true,
    match_about_blank: true,
  }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none'" },
};

// Remove the retired target when rebuilding an earlier local checkout.
await rm(path.join(root, 'dist/firefox'), { recursive: true, force: true });
for (const browser of ['chrome', 'safari']) {
  const manifest = structuredClone(common);
  if (browser === 'chrome') {
    manifest.minimum_chrome_version = '120';
    manifest.background = { service_worker: 'background.js' };
  } else {
    manifest.background = { scripts: ['background.js'] };
  }
  const output = path.join(root, 'dist', browser);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'extension'), output, { recursive: true });
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Built dist/${browser}`);
}
