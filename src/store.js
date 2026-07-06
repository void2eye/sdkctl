import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getHome() {
  return path.resolve(process.env.SDKCTL_HOME || path.join(os.homedir(), '.sdkctl'));
}

export function paths() {
  const home = getHome();
  return {
    home,
    config: path.join(home, 'config.json'),
    shims: path.join(home, 'bin'),
  };
}

export function emptyConfig() {
  return { schema: 1, sdks: {} };
}

export function loadConfig() {
  const { config } = paths();
  if (!fs.existsSync(config)) return emptyConfig();
  let value;
  try {
    value = JSON.parse(fs.readFileSync(config, 'utf8'));
  } catch (error) {
    throw new Error(`配置文件损坏 (${config}): ${error.message}`);
  }
  if (value.schema !== 1 || typeof value.sdks !== 'object') {
    throw new Error(`不支持的配置格式: ${config}`);
  }
  return value;
}

export function saveConfig(config) {
  const target = paths();
  fs.mkdirSync(target.home, { recursive: true });
  const temporary = `${target.config}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target.config);
}

export function ensureStore() {
  const target = paths();
  fs.mkdirSync(target.shims, { recursive: true });
  if (!fs.existsSync(target.config)) saveConfig(emptyConfig());
  return target;
}
