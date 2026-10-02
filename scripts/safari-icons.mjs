import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const native = path.join(root, 'safari');
const master = path.join(root, 'design/icons/app-icon-1024.png');
await access(native);
let count = 0;
async function visit(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (!item.isDirectory() || item.name.startsWith('.')) continue;
    const location = path.join(directory, item.name);
    if (item.name !== 'AppIcon.appiconset') { await visit(location); continue; }
    const contentsPath = path.join(location, 'Contents.json');
    const contents = JSON.parse(await readFile(contentsPath, 'utf8'));
    if (!Array.isArray(contents.images) || !contents.images.length) {
      throw new Error(`No image slots in ${contentsPath}; inspect this Xcode template manually.`);
    }
    const plan = contents.images.map((entry, index) => {
      const dimensions = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(entry.size || '');
      const scale = /^(\d+)x$/.exec(entry.scale || '1x');
      if (!dimensions || dimensions[1] !== dimensions[2] || !scale) {
        throw new Error(`Unsupported AppIcon slot in ${contentsPath}: ${JSON.stringify(entry)}`);
      }
      const size = Number(dimensions[1]) * Number(scale[1]);
      if (!Number.isInteger(size) || size < 1 || size > 1024) throw new Error(`Unsupported icon size ${size}`);
      return { entry, size, filename: `quiet-exit-${index}-${size}.png` };
    });
    for (const { entry, size, filename } of plan) {
      await sharp(master).resize(size, size).removeAlpha().png().toFile(path.join(location, filename));
      entry.filename = filename;
    }
    await writeFile(contentsPath, JSON.stringify(contents, null, 2) + '\n');
    console.log(`Updated ${path.relative(root, location)}`);
    count++;
  }
}
await visit(native);
if (!count) throw new Error('No AppIcon.appiconset found. Inspect the generated Xcode project.');
