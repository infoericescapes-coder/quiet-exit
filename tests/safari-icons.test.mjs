import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, writeFile, readFile, rm, readdir, symlink } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
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

async function fixture(t, images) {
  const repo = fileURLToPath(new URL('../', import.meta.url));
  await mkdir(path.join(repo, 'artifacts'), { recursive: true });
  const temporary = await mkdtemp(path.join(repo, 'artifacts/icon-filename-test-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(path.join(temporary, 'scripts'));
  await mkdir(path.join(temporary, 'design/icons'), { recursive: true });
  await cp(path.join(repo, 'scripts/safari-icons.mjs'), path.join(temporary, 'scripts/safari-icons.mjs'));
  await cp(path.join(repo, 'design/icons/app-icon-1024.png'), path.join(temporary, 'design/icons/app-icon-1024.png'));
  const catalogue = path.join(temporary, 'safari/Shared/Assets.xcassets/AppIcon.appiconset');
  await mkdir(catalogue, { recursive: true });
  const contents = { images, info: { author: 'xcode', version: 1 }, properties: { 'pre-rendered': true } };
  const original = JSON.stringify(contents);
  await writeFile(path.join(catalogue, 'Contents.json'), original);
  return {
    temporary, catalogue, contents, original,
    run() { return spawnSync(process.execPath, [path.join(temporary, 'scripts/safari-icons.mjs')], { encoding: 'utf8' }); }
  };
}

test('existing filenames are reused without creating orphan replacements or changing metadata', async t => {
  const f = await fixture(t, [
    { idiom: 'iphone', size: '60x60', scale: '2x', filename: 'AppIcon-120.png', custom: 'keep' },
    { idiom: 'ipad', size: '83.5x83.5', scale: '2x', filename: 'AppIcon-167.png' },
    { idiom: 'mac', size: '16x16', scale: '1x' }
  ]);
  await writeFile(path.join(f.catalogue, 'AppIcon-120.png'), 'old template icon');
  await writeFile(path.join(f.catalogue, 'AppIcon-167.png'), 'old template icon');
  await writeFile(path.join(f.catalogue, 'unrelated.txt'), 'preserve');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(await readFile(path.join(f.catalogue, 'Contents.json'), 'utf8'));
  assert.deepEqual(updated, {
    ...f.contents,
    images: f.contents.images.map((entry, index) => index === 2 ? { ...entry, filename: 'quiet-exit-2-16.png' } : entry)
  });
  assert.deepEqual((await readdir(f.catalogue)).sort(),
    ['AppIcon-120.png', 'AppIcon-167.png', 'Contents.json', 'quiet-exit-2-16.png', 'unrelated.txt'].sort());
  assert.equal(await readFile(path.join(f.catalogue, 'unrelated.txt'), 'utf8'), 'preserve');
  for (const [index, size] of [120, 167, 16].entries()) {
    const metadata = await sharp(path.join(f.catalogue, updated.images[index].filename)).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    assert.equal(metadata.hasAlpha, false);
  }
});

test('unsafe filenames fail before writing icons or metadata', async t => {
  for (const filename of ['../escape.png', '/absolute.png', 'nested/icon.png', '..\\escape.png', 'C:\\escape.png', '', null, 'Contents.json']) {
    const f = await fixture(t, [{ idiom: 'mac', size: '16x16', scale: '1x', filename }]);
    const result = f.run();
    assert.equal(result.status, 1, String(filename));
    assert.match(result.stderr, /Unsafe AppIcon filename/);
    assert.equal(await readFile(path.join(f.catalogue, 'Contents.json'), 'utf8'), f.original);
    assert.deepEqual(await readdir(f.catalogue), ['Contents.json']);
  }
});

test('conflicting shared filenames are rejected before output, including case differences', async t => {
  const f = await fixture(t, [
    { idiom: 'mac', size: '16x16', scale: '1x', filename: 'Icon.png' },
    { idiom: 'mac', size: '16x16', scale: '2x', filename: 'icon.png' }
  ]);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Conflicting AppIcon sizes/);
  assert.equal(await readFile(path.join(f.catalogue, 'Contents.json'), 'utf8'), f.original);
  assert.deepEqual(await readdir(f.catalogue), ['Contents.json']);
});

test('slots may share a filename when their pixel dimensions agree', async t => {
  const f = await fixture(t, [
    { idiom: 'mac', size: '16x16', scale: '2x', filename: 'Icon.png' },
    { idiom: 'mac', size: '32x32', scale: '1x', filename: 'Icon.png' }
  ]);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.catalogue, 'Contents.json'), 'utf8')), f.contents);
  assert.deepEqual((await readdir(f.catalogue)).sort(), ['Contents.json', 'Icon.png']);
});

test('an existing icon symlink cannot redirect writes outside the catalogue', async t => {
  const f = await fixture(t, [{ idiom: 'mac', size: '16x16', scale: '1x', filename: 'Icon.png' }]);
  const outside = path.join(f.temporary, 'outside.png');
  await writeFile(outside, 'preserve');
  await symlink(outside, path.join(f.catalogue, 'Icon.png'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsafe AppIcon symlink/);
  assert.equal(await readFile(outside, 'utf8'), 'preserve');
  assert.equal(await readFile(path.join(f.catalogue, 'Contents.json'), 'utf8'), f.original);
});
