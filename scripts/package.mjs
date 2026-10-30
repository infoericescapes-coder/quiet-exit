import { mkdir, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await mkdir(path.join(root, 'artifacts'), { recursive: true });
for (const browser of ['chrome', 'safari']) {
  const target = path.join(root, 'artifacts', `quiet-exit-${version}-${browser}.zip`);
  await rm(target, { force: true });
  const result = spawnSync('zip', ['-qr', target, '.'], { cwd: path.join(root, 'dist', browser), stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error || new Error(`zip failed for ${browser}`);
  console.log(target);
}
