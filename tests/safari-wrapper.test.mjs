import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const generator = await readFile(new URL('../scripts/safari.mjs', import.meta.url), 'utf8');
const configurations = ['macOS app Debug', 'macOS app Release', 'iOS app Debug', 'iOS app Release',
  'macOS extension Debug', 'macOS extension Release', 'iOS extension Debug', 'iOS extension Release'];
const template = configurations.map(name => `/* ${name} */\n{\n\tCURRENT_PROJECT_VERSION = 9;\n\tMARKETING_VERSION = 1.0;\n\t${name.startsWith('iOS') ? 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;' : 'MACOSX_DEPLOYMENT_TARGET = 10.14;'}\n\tOTHER_SETTING = preserved;\n}\n`).join('');

async function fixture(t, project = template) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'quiet-exit-wrapper-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'bin'));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.1.2' }));
  await writeFile(path.join(root, 'scripts/safari.mjs'), generator);
  await writeFile(path.join(root, 'scripts/safari-icons.mjs'),
    "import {writeFileSync} from 'node:fs'; writeFileSync(new URL('../icons-ran', import.meta.url), 'yes');");
  await writeFile(path.join(root, 'template.txt'), project);
  await writeFile(path.join(root, 'bin/xcrun'), `#!${process.execPath}\n
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === '--find') process.exit(0);
const output = args[args.indexOf('--project-location') + 1];
const project = path.join(output, 'Quiet Exit', 'Quiet Exit.xcodeproj');
fs.mkdirSync(project, {recursive: true});
fs.writeFileSync(path.join(project, 'project.pbxproj'), fs.readFileSync(path.join(process.cwd(), 'template.txt')));
`, { mode: 0o755 });
  return {
    root,
    project: path.join(root, 'safari/Quiet Exit/Quiet Exit.xcodeproj/project.pbxproj'),
    run() {
      return spawnSync(process.execPath, ['scripts/safari.mjs'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}` }
      });
    }
  };
}

test('fresh converter output stamps all app and extension configurations and retains other settings', async t => {
  const f = await fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const generated = await readFile(f.project, 'utf8');
  assert.equal(generated, template.replaceAll('CURRENT_PROJECT_VERSION = 9;', 'CURRENT_PROJECT_VERSION = 1;')
    .replaceAll('MARKETING_VERSION = 1.0;', 'MARKETING_VERSION = 0.1.2;')
    .replaceAll('IPHONEOS_DEPLOYMENT_TARGET = 15.0;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.4;'));
  for (const name of configurations) {
    const block = generated.slice(generated.indexOf(`/* ${name} */`)).split('}')[0];
    assert.match(block, name.startsWith('iOS')
      ? /IPHONEOS_DEPLOYMENT_TARGET = 15\.4;/ : /MACOSX_DEPLOYMENT_TARGET = 10\.14;/);
  }
  await access(path.join(f.root, 'icons-ran'));
});

test('existing wrapper refusal preserves native edits and skips icon setup', async t => {
  const f = await fixture(t);
  await mkdir(path.dirname(f.project), { recursive: true });
  const existing = 'MARKETING_VERSION = 7.8.9;\nCURRENT_PROJECT_VERSION = 42;\nIPHONEOS_DEPLOYMENT_TARGET = 15.0;\n// native edits\n';
  await writeFile(f.project, existing);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /safari\/ already exists/);
  assert.equal(await readFile(f.project, 'utf8'), existing);
  await assert.rejects(access(path.join(f.root, 'icons-ran')), { code: 'ENOENT' });
});

test('unrecognised converter version settings fail visibly without running icon setup', async t => {
  const f = await fixture(t, '// missing expected native version settings\n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing native version settings/);
  assert.equal(await readFile(f.project, 'utf8'), '// missing expected native version settings\n');
  await assert.rejects(access(path.join(f.root, 'icons-ran')), { code: 'ENOENT' });
});

test('unsupported package version fails before creating a native wrapper', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'package.json'), JSON.stringify({ version: '0.1.2-beta.1' }));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported native app version/);
  await assert.rejects(access(path.join(f.root, 'safari')), { code: 'ENOENT' });
});

test('missing iOS deployment settings fail before stamping a generated project', async t => {
  const project = 'MARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\n';
  const f = await fixture(t, project);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing iOS deployment settings/);
  assert.equal(await readFile(f.project, 'utf8'), project);
  await assert.rejects(access(path.join(f.root, 'icons-ran')), { code: 'ENOENT' });
});
