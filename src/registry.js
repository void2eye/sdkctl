import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultDefinition, normalizeSdkName, SDK_TYPES } from './catalog.js';

function executablePath(home, parts) {
  const base = path.join(home, ...parts);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  if (process.platform === 'win32' && fs.existsSync(`${base}.exe`) && fs.statSync(`${base}.exe`).isFile()) return `${base}.exe`;
  return null;
}

function hasMarker(home, marker) {
  return Boolean(executablePath(home, marker));
}

export function identifySdk(home) {
  for (const [name, definition] of Object.entries(SDK_TYPES)) {
    if (definition.markers.some((marker) => hasMarker(home, marker))) return name;
  }
  return null;
}

function commandVersion(command, args, pattern) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 4000, windowsHide: true });
  if (result.error || result.status !== 0) return null;
  const match = `${result.stdout}\n${result.stderr}`.match(pattern);
  return match?.[1] || null;
}

export function detectVersion(sdk, home) {
  if (sdk === 'java') {
    const release = path.join(home, 'release');
    if (fs.existsSync(release)) {
      const match = fs.readFileSync(release, 'utf8').match(/^JAVA_VERSION="?([^"\r\n]+)"?/m);
      if (match) return match[1];
    }
    return commandVersion(executablePath(home, ['bin', 'java']), ['-version'], /version\s+"([^"]+)"/i);
  }
  if (sdk === 'php') {
    return commandVersion(executablePath(home, ['php']), ['-n', '-r', 'echo PHP_VERSION;'], /(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/);
  }
  if (sdk === 'go') {
    const versionFile = path.join(home, 'VERSION');
    if (fs.existsSync(versionFile)) return fs.readFileSync(versionFile, 'utf8').split(/\r?\n/, 1)[0].trim().replace(/^go/, '');
    return commandVersion(executablePath(home, ['bin', 'go']), ['version'], /go version go([^\s]+)/);
  }
  if (sdk === 'node') {
    return commandVersion(executablePath(home, ['node']), ['--version'], /v([^\s]+)/);
  }
  if (sdk === 'python') {
    return commandVersion(executablePath(home, ['python']), ['--version'], /Python\s+([^\s]+)/i);
  }
  return path.basename(home);
}

export function addVersion(config, rawName, version, rawHome) {
  const name = normalizeSdkName(rawName);
  if (!name) throw new Error('SDK 名称不能为空');
  const home = path.resolve(rawHome);
  if (!fs.existsSync(home) || !fs.statSync(home).isDirectory()) throw new Error(`目录不存在: ${home}`);
  const definition = defaultDefinition(name);
  if (definition.markers.length && !definition.markers.some((marker) => hasMarker(home, marker))) {
    throw new Error(`${home} 看起来不是有效的 ${name} SDK 目录`);
  }
  const actualVersion = version || detectVersion(name, home);
  if (!actualVersion) throw new Error(`无法识别 ${name} 版本，请显式提供版本号`);
  config.sdks[name] ||= { active: null, versions: {} };
  let versionKey = actualVersion;
  const existing = config.sdks[name].versions[versionKey];
  if (existing && path.resolve(existing.home) !== home) {
    const suffix = path.basename(home).replace(/[^\w.-]+/g, '-');
    versionKey = `${actualVersion}@${suffix}`;
    let sequence = 2;
    while (config.sdks[name].versions[versionKey] && path.resolve(config.sdks[name].versions[versionKey].home) !== home) {
      versionKey = `${actualVersion}@${suffix}-${sequence}`;
      sequence += 1;
    }
  }
  config.sdks[name].versions[versionKey] = { home };
  return { name, version: versionKey, home };
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'www', 'data', 'cache', 'logs', 'temp', 'tmp']);

export function scanRoots(config, roots, options = {}) {
  const maxDepth = options.maxDepth ?? 6;
  const found = [];
  const seen = new Set();

  function visit(directory, depth) {
    let real;
    try {
      real = fs.realpathSync(directory);
      if (seen.has(real) || !fs.statSync(real).isDirectory()) return;
      seen.add(real);
    } catch { return; }

    const sdk = identifySdk(real);
    if (sdk) {
      try { found.push(addVersion(config, sdk, null, real)); } catch { /* invalid candidate */ }
      return;
    }
    if (depth >= maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(real, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP_DIRS.has(entry.name.toLowerCase())) continue;
      visit(path.join(real, entry.name), depth + 1);
    }
  }

  for (const root of roots) visit(path.resolve(root), 0);
  return found;
}

export function resolveVersion(config, rawName, requested) {
  const name = normalizeSdkName(rawName);
  const sdk = config.sdks[name];
  if (!sdk) throw new Error(`尚未登记 SDK: ${name}`);
  if (sdk.versions[requested]) return { name, version: requested, entry: sdk.versions[requested] };
  const matches = Object.keys(sdk.versions).filter((version) => version === requested || version.startsWith(`${requested}.`) || version.startsWith(requested));
  if (matches.length === 1) return { name, version: matches[0], entry: sdk.versions[matches[0]] };
  if (matches.length > 1) throw new Error(`版本 “${requested}” 不唯一: ${matches.join(', ')}`);
  throw new Error(`未找到 ${name} ${requested}`);
}
