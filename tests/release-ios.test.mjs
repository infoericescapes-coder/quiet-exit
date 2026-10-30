import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const release = await readFile(new URL('../scripts/release-ios.sh', import.meta.url), 'utf8');
const appID = 'com.ericescapes.quietexit';
const extensionID = `${appID}.Extension`;
const templates = {
  'project.pbxproj': `{
\tPRODUCT_BUNDLE_IDENTIFIER = ${appID};
\tPRODUCT_BUNDLE_IDENTIFIER = "${extensionID}";
\tOTHER_SETTING = preserved;
}
`,
  'project.xcproj': `{
  "targets": [
    { "name": "Quiet Exit (iOS)", "build-settings": {
      "PRODUCT_BUNDLE_IDENTIFIER": "${appID}",
      "OTHER_SETTING": "preserved",
    }, },
    { "name": "Quiet Exit Extension (iOS)", "build-settings": {
      "PRODUCT_BUNDLE_IDENTIFIER": "${extensionID}",
    }, },
  ],
}
`
};

async function fixture(t, filename, project = templates[filename]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'quiet-exit-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectDirectory = path.join(root, 'safari/Quiet Exit/Quiet Exit.xcodeproj');
  for (const directory of ['scripts', 'dist/safari', 'bin', projectDirectory]) {
    await mkdir(path.resolve(root, directory), { recursive: true });
  }
  await writeFile(path.join(root, 'scripts/release-ios.sh'), release);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.1.3' }));
  await writeFile(path.join(root, 'dist/safari/manifest.json'), JSON.stringify({
    version: '0.1.3', manifest_version: 3, background: { service_worker: 'background.js' }, content_scripts: []
  }));
  const projectPath = path.join(projectDirectory, filename);
  if (project !== null) await writeFile(projectPath, project);
  // Any release tool or API-helper invocation fails and leaves evidence.
  // Preflight receives none of the required signing-profile or API inputs.
  for (const command of ['python3', 'xcodebuild', 'security', 'codesign', 'curl', 'openssl']) {
    await writeFile(path.join(root, 'bin', command),
      '#!/bin/sh\nprintf "%s\\n" "$0" >> "$RELEASE_FORBIDDEN_CALLS"\nexit 99\n', { mode: 0o755 });
  }
  return {
    root, projectDirectory, projectPath,
    run(environment = {}) {
      return spawnSync('/bin/bash', ['scripts/release-ios.sh'], {
        cwd: root, encoding: 'utf8', timeout: 10000,
        env: { ...process.env,
          PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
          ASC_APP_ID: '6818695484', BUILD_NUMBER: '2',
          APP_PROFILE_UUID: '', EXTENSION_PROFILE_UUID: '',
          ASC_API_SCRIPT: path.join(root, 'must-not-run-api.py'),
          RELEASE_FORBIDDEN_CALLS: path.join(root, 'forbidden-calls'), ...environment }
      });
    },
    async assertNoReleaseEffects() {
      await assert.rejects(access(path.join(root, 'forbidden-calls')), { code: 'ENOENT' });
      await assert.rejects(access(path.join(root, 'artifacts')), { code: 'ENOENT' });
      if (project !== null) assert.equal(await readFile(projectPath, 'utf8'), project);
    }
  };
}

for (const filename of Object.keys(templates)) {
  test(`${filename}: local release preflight validates exact IDs without credentials or release tools`, async t => {
    const f = await fixture(t, filename);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Plan: Quiet Exit 0\.1\.3 \(2\), ASC app 6818695484/);
    assert.match(result.stdout, /Local preflight passed\. Account, provisioning and identity readiness are not verified\./);
    await f.assertNoReleaseEffects();
  });

  for (const [label, wrongID] of [['wrong app', `${appID}.wrong`], ['wrong extension', `${extensionID}.wrong`]]) {
    test(`${filename}: ${label} ID is rejected even when it starts with the expected ID`, async t => {
      const expected = label === 'wrong app' ? appID : extensionID;
      const project = templates[filename].replace(
        filename === 'project.pbxproj' ? `${expected};` : `"${expected}"`,
        filename === 'project.pbxproj' ? `${wrongID};` : `"${wrongID}"`);
      // The legacy extension value is quoted.
      const changed = project === templates[filename]
        ? project.replace(`"${expected}"`, `"${wrongID}"`) : project;
      const f = await fixture(t, filename, changed);
      const result = f.run();
      assert.equal(result.status, 1, result.stdout);
      assert.ok(result.stderr.includes(`native wrapper is missing expected bundle ID ${expected}`), result.stderr);
      await f.assertNoReleaseEffects();
    });
  }

  test(`${filename}: an unexpected target ID cannot hide alongside the expected app and extension IDs`, async t => {
    const project = templates[filename].replace(filename === 'project.pbxproj'
      ? '\tOTHER_SETTING' : '      "OTHER_SETTING"', filename === 'project.pbxproj'
      ? '\tPRODUCT_BUNDLE_IDENTIFIER = com.example.wrong;\n\tOTHER_SETTING'
      : '      "PRODUCT_BUNDLE_IDENTIFIER": "com.example.wrong",\n      "OTHER_SETTING"');
    const f = await fixture(t, filename, project);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /native wrapper has unexpected bundle ID com\.example\.wrong/);
    await f.assertNoReleaseEffects();
  });

  test(`${filename}: expected IDs in comments or unrelated strings cannot satisfy the bundle checks`, async t => {
    const project = filename === 'project.pbxproj'
      ? `// PRODUCT_BUNDLE_IDENTIFIER = ${appID};\n/*\nPRODUCT_BUNDLE_IDENTIFIER = ${appID};\nPRODUCT_BUNDLE_IDENTIFIER = ${extensionID};\n*/\n`
      : `{\n  "NOTE": "PRODUCT_BUNDLE_IDENTIFIER: ${appID}",\n  "OTHER": "${extensionID}",\n/*\n  "PRODUCT_BUNDLE_IDENTIFIER": "${appID}",\n  "PRODUCT_BUNDLE_IDENTIFIER": "${extensionID}",\n*/\n}\n`;
    const f = await fixture(t, filename, project);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /native wrapper .*bundle ID/);
    await f.assertNoReleaseEffects();
  });

  test(`${filename}: whitespace inside a quoted bundle ID is not an exact match`, async t => {
    const project = templates[filename].replace(`"${extensionID}"`, `" ${extensionID} "`);
    const f = await fixture(t, filename, project);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`native wrapper is missing expected bundle ID ${extensionID}`), result.stderr);
    await f.assertNoReleaseEffects();
  });
}

test('missing native project fails before release tools or credential handling', async t => {
  const f = await fixture(t, 'project.xcproj', null);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /generate the native wrapper before release/);
  await f.assertNoReleaseEffects();
});

test('relative distribution key override fails during local preflight without release effects', async t => {
  const f = await fixture(t, 'project.xcproj');
  const result = f.run({ DISTRIBUTION_PRIVATE_KEY: 'private_keys/existing.key' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DISTRIBUTION_PRIVATE_KEY must be an absolute path/);
  await f.assertNoReleaseEffects();
});

test('absolute distribution key override does not require the file during local preflight', async t => {
  const f = await fixture(t, 'project.xcproj');
  const result = f.run({ DISTRIBUTION_PRIVATE_KEY: path.join(f.root, 'absent existing key.key') });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Local preflight passed/);
  await f.assertNoReleaseEffects();
});
