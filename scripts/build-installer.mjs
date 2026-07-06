import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.ISCC_PATH,
  path.join(project, '.tools', 'Inno Setup 6', 'ISCC.exe'),
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 7\\ISCC.exe',
].filter(Boolean);
const compiler = candidates.find((candidate) => fs.existsSync(candidate));
if (!compiler) throw new Error('未找到 Inno Setup 编译器。请安装 Inno Setup 6，或设置 ISCC_PATH。');

execFileSync(compiler, [path.join(project, 'packaging', 'sdkctl.iss')], {
  cwd: project,
  stdio: 'inherit',
});
