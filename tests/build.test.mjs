import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';

test('browser packages reference real local assets and minimal APIs', async () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
  for (const browser of ['chrome', 'safari']) {
    const base = new URL(`../dist/${browser}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json', base)));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.equal(manifest.content_scripts[0].all_frames, true);
    const files = [manifest.action.default_popup, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
      ...manifest.content_scripts.flatMap(entry => entry.js),
      ...(manifest.background.scripts || [manifest.background.service_worker])];
    for (const file of files) await access(new URL(file, base));
    assert.match(await readFile(new URL('assets/TABLER-LICENSE', base), 'utf8'), /Permission is hereby granted/);
    if (browser === 'chrome') assert.ok(manifest.background.service_worker);
    else assert.ok(manifest.background.scripts);
  }
});
