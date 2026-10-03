import { spawnSync } from 'node:child_process';
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
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
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Unsupported native app version ${version}; use a numeric three-part package version.`);
}
const result = spawnSync('xcrun', [tool, path.join(root, 'dist/safari'),
  '--project-location', output, '--app-name', 'Quiet Exit',
  '--bundle-identifier', 'com.ericescapes.quietexit', '--swift', '--no-open', '--no-prompt'],
{ stdio: 'inherit' });
if (result.error || result.status !== 0) throw result.error || new Error('Safari packaging failed');
// Only the newly converted wrapper reaches this point. Existing native edits
// remain protected by the safari/ refusal above.
let projects = 0;
async function stampVersions(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, item.name);
    if (item.isDirectory()) {
      await stampVersions(location);
    } else if (item.name === 'project.pbxproj') {
      const project = await readFile(location, 'utf8');
      const marketing = /^([\t ]*MARKETING_VERSION\s*=\s*)[^;\r\n]+;/gm;
      const build = /^([\t ]*CURRENT_PROJECT_VERSION\s*=\s*)[^;\r\n]+;/gm;
      const iosDeployment = /^([\t ]*IPHONEOS_DEPLOYMENT_TARGET\s*=\s*)[^;\r\n]+;/gm;
      if (!marketing.test(project) || !build.test(project)) {
        throw new Error(`Missing native version settings in ${location}; inspect the generated Xcode project.`);
      }
      if (!iosDeployment.test(project)) {
        throw new Error(`Missing iOS deployment settings in ${location}; inspect the generated Xcode project.`);
      }
      marketing.lastIndex = build.lastIndex = iosDeployment.lastIndex = 0;
      await writeFile(location, project
        .replace(marketing, (_, prefix) => `${prefix}${version};`)
        .replace(build, (_, prefix) => `${prefix}1;`)
        .replace(iosDeployment, (_, prefix) => `${prefix}15.4;`));
      projects++;
    }
  }
}
await stampVersions(output);
if (!projects) throw new Error('No generated Xcode project found for version setup.');
const icons = spawnSync(process.execPath, [path.join(root, 'scripts/safari-icons.mjs')], { stdio: 'inherit' });
if (icons.error || icons.status !== 0) throw icons.error || new Error('Safari app icon setup failed; inspect safari/ before building.');
console.log('Open the project in safari/ with Xcode, choose your signing team, and build the macOS or iOS app.');
