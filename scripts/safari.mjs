import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'safari');
const tool = ['safari-web-extension-packager', 'safari-web-extension-converter']
  .find(name => spawnSync('xcrun', ['--find', name], { stdio: 'ignore' }).status === 0);
if (!tool) {
  console.error('Safari packaging needs full Xcode. Command Line Tools alone do not include the Safari packager.');
  console.error('Install Xcode, select it with xcode-select, then run npm run safari again.');
  process.exit(1);
}
try {
  await access(output);
  console.error('safari/ already exists. Preserve any signing settings or native edits; choose a new project location manually to regenerate.');
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const result = spawnSync('xcrun', [tool, path.join(root, 'dist/safari'),
  '--project-location', output, '--app-name', 'Quiet Exit',
  '--bundle-identifier', 'com.ericescapes.quietexit', '--swift', '--no-open', '--no-prompt'],
{ stdio: 'inherit' });
if (result.error || result.status !== 0) throw result.error || new Error('Safari packaging failed');
const icons = spawnSync(process.execPath, [path.join(root, 'scripts/safari-icons.mjs')], { stdio: 'inherit' });
if (icons.error || icons.status !== 0) throw icons.error || new Error('Safari app icon setup failed; inspect safari/ before building.');
console.log('Open the project in safari/ with Xcode, choose your signing team, and build the macOS or iOS app.');
