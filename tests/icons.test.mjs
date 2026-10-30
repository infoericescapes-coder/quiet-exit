import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

test('toolbar glyphs preserve transparent space instead of tinting as a solid square', async () => {
  for (const browser of ['safari', 'chrome']) {
    for (const size of [16, 19, 32, 38, 48]) {
      const { data, info } = await sharp(fileURLToPath(new URL(`../extension/assets/toolbar-${browser}-${size}.png`, import.meta.url)))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, size);
      assert.equal(info.height, size);
      const alpha = Array.from(data).filter((_, i) => i % 4 === 3);
      assert.equal(alpha[0], 0);
      assert.ok(alpha.filter(value => value === 0).length > size * size / 3);
      assert.ok(alpha.filter(value => value > 128).length > size * size / 5);
    }
  }
});

test('Apple app master is square 1024px with no alpha channel', async () => {
  const metadata = await sharp(fileURLToPath(new URL('../design/icons/app-icon-1024.png', import.meta.url))).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.hasAlpha, false);
});
