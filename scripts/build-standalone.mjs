import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(project, 'dist');
const bundled = path.join(dist, 'sdkctl.cjs');
const blob = path.join(dist, 'sdkctl.blob');
const executable = path.join(dist, 'sdkctl.exe');
const configPath = path.join(dist, 'sea-config.json');
const postject = path.join(project, 'node_modules', '.bin', process.platform === 'win32' ? 'postject.cmd' : 'postject');

function findSignTool() {
  const configured = process.env.SIGNTOOL_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  const root = path.join(project, '.tools', 'WindowsSDKBuildTools', 'bin');
  if (!fs.existsSync(root)) return null;
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.name.toLowerCase() === 'signtool.exe' && target.toLowerCase().includes(`${path.sep}x64${path.sep}`)) return target;
    }
  }
  return null;
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(project, 'bin', 'sdkctl.js')],
  outfile: bundled,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  minify: true,
  sourcemap: false,
});

fs.writeFileSync(configPath, `${JSON.stringify({
  main: bundled,
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
}, null, 2)}\n`);

execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' });
fs.copyFileSync(process.execPath, executable);
if (process.platform === 'win32') {
  const signTool = findSignTool();
  if (signTool) execFileSync(signTool, ['remove', '/s', executable], { stdio: 'inherit' });
  else console.warn('SignTool not found; the inherited Node signature was not removed. Release signing may fail.');
}
execFileSync(postject, [
  executable,
  'NODE_SEA_BLOB',
  blob,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
], { cwd: project, stdio: 'inherit', shell: process.platform === 'win32' });

for (const temporary of [bundled, blob, configPath]) fs.rmSync(temporary, { force: true });
console.log(`Standalone executable: ${executable}`);
