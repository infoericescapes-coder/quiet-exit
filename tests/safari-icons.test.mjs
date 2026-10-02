import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

test('native app icons cover modern iOS, iPad fractional points and macOS scales without losing metadata', async () => {
  const repo = fileURLToPath(new URL('../', import.meta.url));
  await mkdir(path.join(repo, 'artifacts'), { recursive: true });
  const temporary = await mkdtemp(path.join(repo, 'artifacts/icon-test-'));
  try {
    await mkdir(path.join(temporary, 'scripts'));
    await mkdir(path.join(temporary, 'design/icons'), { recursive: true });
    await cp(path.join(repo, 'scripts/safari-icons.mjs'), path.join(temporary, 'scripts/safari-icons.mjs'));
    await cp(path.join(repo, 'design/icons/app-icon-1024.png'), path.join(temporary, 'design/icons/app-icon-1024.png'));
    const catalogue = path.join(temporary, 'safari/Shared/Assets.xcassets/AppIcon.appiconset');
    await mkdir(catalogue, { recursive: true });
    const images = [
      { idiom: 'universal', platform: 'ios', size: '1024x1024' },
      { idiom: 'ipad', size: '83.5x83.5', scale: '2x' },
      { idiom: 'mac', size: '512x512', scale: '2x' },
    ];
    await writeFile(path.join(catalogue, 'Contents.json'), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }));
    execFileSync(process.execPath, [path.join(temporary, 'scripts/safari-icons.mjs')]);
    const result = JSON.parse(await readFile(path.join(catalogue, 'Contents.json')));
    assert.deepEqual(result.info, { author: 'xcode', version: 1 });
    for (const [index, size] of [1024, 167, 1024].entries()) {
      const entry = result.images[index];
      assert.deepEqual({ ...entry, filename: undefined }, { ...images[index], filename: undefined });
      const metadata = await sharp(path.join(catalogue, entry.filename)).metadata();
      assert.equal(metadata.width, size);
      assert.equal(metadata.height, size);
      assert.equal(metadata.hasAlpha, false);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
