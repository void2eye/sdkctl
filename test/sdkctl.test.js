import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { run } from '../src/cli.js';
import { loadConfig, paths } from '../src/store.js';
import { addVersion, identifySdk, scanRoots } from '../src/registry.js';

function capture() {
  const output = [];
  return { output, io: { log: (value) => output.push(String(value)) } };
}

test('add, use and remove a custom SDK', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkctl-'));
  const oldHome = process.env.SDKCTL_HOME;
  process.env.SDKCTL_HOME = path.join(temporary, 'state');
  const sdkHome = path.join(temporary, 'acme-1');
  fs.mkdirSync(sdkHome);
  try {
    let result = capture();
    await run(['add', 'acme', '1.2.3', sdkHome], result.io);
    assert.match(result.output[0], /已登记 acme 1\.2\.3/);

    result = capture();
    await run(['use', 'acme', '1.2'], result.io);
    assert.equal(loadConfig().sdks.acme.active, '1.2.3');

    result = capture();
    await run(['env', '--shell', 'powershell'], result.io);
    assert.match(result.output[0], /ACME_HOME/);
    assert.match(result.output[0], /-contains/);
    assert.match(result.output[0], new RegExp(paths().shims.replaceAll('\\', '\\\\')));

    result = capture();
    await run(['shell-init', 'powershell'], result.io);
    assert.match(result.output[0], /function global:sdk/);
    assert.match(result.output[0], /SdkctlCommand env --shell powershell/);

    await run(['remove', 'acme', '1.2.3'], capture().io);
    assert.equal(loadConfig().sdks.acme.active, null);
  } finally {
    if (oldHome === undefined) delete process.env.SDKCTL_HOME;
    else process.env.SDKCTL_HOME = oldHome;
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('marker must be an executable file and duplicate versions keep both homes', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkctl-registry-'));
  try {
    fs.mkdirSync(path.join(temporary, 'php'));
    assert.equal(identifySdk(temporary), null);

    const first = path.join(temporary, 'jdk-a');
    const second = path.join(temporary, 'jdk-b');
    for (const home of [first, second]) {
      fs.mkdirSync(path.join(home, 'bin'), { recursive: true });
      fs.writeFileSync(path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), '');
    }
    const config = { schema: 1, sdks: {} };
    addVersion(config, 'java', '17.0.1', first);
    const duplicate = addVersion(config, 'java', '17.0.1', second);
    assert.equal(duplicate.version, '17.0.1@jdk-b');
    assert.equal(Object.keys(config.sdks.java.versions).length, 2);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('scan detects a Go SDK from its VERSION file', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkctl-go-'));
  try {
    const goHome = path.join(temporary, 'go');
    fs.mkdirSync(path.join(goHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(goHome, 'bin', process.platform === 'win32' ? 'go.exe' : 'go'), '');
    fs.writeFileSync(path.join(goHome, 'VERSION'), 'go1.24.1\ntime 2026-01-01T00:00:00Z\n');
    const config = { schema: 1, sdks: {} };
    const found = scanRoots(config, [temporary]);
    assert.equal(found[0].name, 'go');
    assert.equal(found[0].version, '1.24.1');
    assert.equal(config.sdks.go.versions['1.24.1'].home, goHome);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
