import fs from 'node:fs';
import path from 'node:path';
import { normalizeSdkName } from './catalog.js';
import { addVersion, resolveVersion, scanRoots } from './registry.js';
import { ensureStore, loadConfig, paths, saveConfig } from './store.js';
import { rebuildShims, renderEnvironment, renderShellInit } from './shims.js';

const VERSION = '0.1.3';

const HELP = `sdkctl ${VERSION} — 管理本机的 SDK 版本

用法:
  sdk init
  sdk scan [目录...] [--depth 6]
  sdk add <sdk> <版本|auto> <目录>
  sdk list [sdk]
  sdk use <sdk> <版本>
  sdk current [sdk]
  sdk remove <sdk> <版本>
  sdkctl env [--shell powershell|cmd|bash]
  sdkctl shell-init [powershell|bash]
  sdk doctor

别名: jdk → java, golang → go, nodejs → node, py → python
环境变量: SDKCTL_HOME 可修改配置与 shim 的存放目录`;

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} 缺少值`);
  return args[index + 1];
}

function positionals(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index].startsWith('--')) index += 1;
    else result.push(args[index]);
  }
  return result;
}

function table(rows) {
  if (!rows.length) return '（空）';
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => String(row[column]).length)));
  return rows.map((row) => row.map((cell, column) => String(cell).padEnd(widths[column])).join('  ')).join('\n');
}

function list(config, sdkFilter) {
  const filter = sdkFilter ? normalizeSdkName(sdkFilter) : null;
  const rows = [['SDK', '版本', '状态', '目录']];
  for (const name of Object.keys(config.sdks).sort()) {
    if (filter && name !== filter) continue;
    const sdk = config.sdks[name];
    for (const version of Object.keys(sdk.versions).sort()) {
      rows.push([name, version, sdk.active === version ? '*' : '', sdk.versions[version].home]);
    }
  }
  return table(rows);
}

function doctor(config) {
  const rows = [['检查项', '结果', '说明']];
  rows.push(['配置目录', 'OK', paths().home]);
  rows.push(['shim PATH', process.env.PATH?.split(path.delimiter).some((item) => path.resolve(item || '.') === paths().shims) ? 'OK' : 'WARN', paths().shims]);
  for (const [name, sdk] of Object.entries(config.sdks)) {
    if (!sdk.active) rows.push([name, 'WARN', '未选择活动版本']);
    else rows.push([name, fs.existsSync(sdk.versions[sdk.active]?.home || '') ? 'OK' : 'ERROR', `${sdk.active} → ${sdk.versions[sdk.active]?.home || '记录缺失'}`]);
  }
  return table(rows);
}

export async function run(argv, io = console) {
  const [command = 'help', ...args] = argv;
  if (command === 'help' || command === '--help' || command === '-h') return io.log(HELP);
  if (command === '--version' || command === '-v' || command === 'version') return io.log(VERSION);
  ensureStore();
  const config = loadConfig();

  if (command === 'init') {
    rebuildShims(config);
    io.log(`已初始化: ${paths().home}`);
    io.log(`下一步: sdkctl scan ${process.cwd()}`);
    return;
  }
  if (command === 'scan') {
    const roots = positionals(args);
    const depth = Number(option(args, '--depth', 6));
    if (!Number.isInteger(depth) || depth < 0 || depth > 20) throw new Error('--depth 必须是 0 到 20 的整数');
    const found = scanRoots(config, roots.length ? roots : [process.cwd()], { maxDepth: depth });
    saveConfig(config);
    io.log(found.length ? `已发现并登记 ${found.length} 个 SDK:\n${table([['SDK', '版本', '目录'], ...found.map((item) => [item.name, item.version, item.home])])}` : '没有发现新的 SDK');
    return;
  }
  if (command === 'add') {
    const [name, version, home] = positionals(args);
    if (!name || !version || !home) throw new Error('用法: sdkctl add <sdk> <版本|auto> <目录>');
    const added = addVersion(config, name, version === 'auto' ? null : version, home);
    saveConfig(config);
    io.log(`已登记 ${added.name} ${added.version}: ${added.home}`);
    return;
  }
  if (command === 'list' || command === 'ls') return io.log(list(config, positionals(args)[0]));
  if (command === 'use') {
    const [name, version] = positionals(args);
    if (!name || !version) throw new Error('用法: sdkctl use <sdk> <版本> [--shell powershell|cmd|bash]');
    const resolved = resolveVersion(config, name, version);
    config.sdks[resolved.name].active = resolved.version;
    saveConfig(config);
    rebuildShims(config);
    const shell = option(args, '--shell');
    if (shell) io.log(renderEnvironment(config, shell));
    else if (args.includes('--hook')) io.log(`已切换 ${resolved.name} → ${resolved.version}`);
    else io.log(`已切换 ${resolved.name} → ${resolved.version}\n提示: PowerShell 中使用 “sdk use ${resolved.name} ${resolved.version}” 可自动刷新当前终端。`);
    return;
  }
  if (command === 'current') {
    const requested = positionals(args)[0];
    if (requested) {
      const name = normalizeSdkName(requested);
      const sdk = config.sdks[name];
      return io.log(sdk?.active ? `${name} ${sdk.active} ${sdk.versions[sdk.active].home}` : `${name}: 未选择`);
    }
    const rows = [['SDK', '活动版本', '目录']];
    for (const [name, sdk] of Object.entries(config.sdks)) if (sdk.active) rows.push([name, sdk.active, sdk.versions[sdk.active].home]);
    return io.log(table(rows));
  }
  if (command === 'remove' || command === 'rm') {
    const [name, requested] = positionals(args);
    if (!name || !requested) throw new Error('用法: sdkctl remove <sdk> <版本>');
    const resolved = resolveVersion(config, name, requested);
    delete config.sdks[resolved.name].versions[resolved.version];
    if (config.sdks[resolved.name].active === resolved.version) config.sdks[resolved.name].active = null;
    saveConfig(config);
    rebuildShims(config);
    io.log(`已移除登记（未删除 SDK 文件）: ${resolved.name} ${resolved.version}`);
    return;
  }
  if (command === 'env') return io.log(renderEnvironment(config, option(args, '--shell', process.platform === 'win32' ? 'powershell' : 'bash')));
  if (command === 'shell-init') return io.log(renderShellInit(positionals(args)[0] || (process.platform === 'win32' ? 'powershell' : 'bash')));
  if (command === 'doctor') return io.log(doctor(config));
  throw new Error(`未知命令: ${command}\n\n${HELP}`);
}
