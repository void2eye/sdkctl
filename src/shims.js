import fs from 'node:fs';
import path from 'node:path';
import { defaultDefinition } from './catalog.js';
import { paths } from './store.js';

function findExecutable(home, sdk, executable) {
  const candidates = sdk === 'php' || sdk === 'node' || sdk === 'python'
    ? [path.join(home, executable), path.join(home, 'bin', executable)]
    : [path.join(home, 'bin', executable), path.join(home, executable)];
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const candidate of candidates) {
    for (const extension of extensions) {
      if (fs.existsSync(`${candidate}${extension}`)) return `${candidate}${extension}`;
    }
  }
  return null;
}

function quoteCmd(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteSh(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function rebuildShims(config) {
  const shimDir = paths().shims;
  fs.mkdirSync(shimDir, { recursive: true });
  for (const entry of fs.readdirSync(shimDir)) {
    const target = path.join(shimDir, entry);
    if (fs.statSync(target).isFile()) fs.rmSync(target);
  }
  const created = [];
  for (const [sdkName, sdk] of Object.entries(config.sdks)) {
    if (!sdk.active || !sdk.versions[sdk.active]) continue;
    const home = sdk.versions[sdk.active].home;
    for (const executable of defaultDefinition(sdkName).executables) {
      const target = findExecutable(home, sdkName, executable);
      if (!target) continue;
      const cmdPath = path.join(shimDir, `${executable}.cmd`);
      fs.writeFileSync(cmdPath, `@echo off\r\n${quoteCmd(target)} %*\r\n`, 'utf8');
      const shPath = path.join(shimDir, executable);
      fs.writeFileSync(shPath, `#!/bin/sh\nexec ${quoteSh(target)} "$@"\n`, { encoding: 'utf8', mode: 0o755 });
      created.push(executable);
    }
  }
  return created;
}

function psQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function renderEnvironment(config, shell = process.platform === 'win32' ? 'powershell' : 'bash') {
  const values = [];
  for (const [name, sdk] of Object.entries(config.sdks)) {
    values.push([defaultDefinition(name).homeEnv, sdk.active && sdk.versions[sdk.active] ? sdk.versions[sdk.active].home : null]);
  }
  const shimDir = paths().shims;
  if (shell === 'powershell' || shell === 'pwsh') {
    return [
      `if (-not (($env:Path -split [IO.Path]::PathSeparator) -contains ${psQuote(shimDir)})) { $env:Path = ${psQuote(shimDir)} + [IO.Path]::PathSeparator + $env:Path }`,
      ...values.map(([key, value]) => value ? `$env:${key} = ${psQuote(value)}` : `Remove-Item Env:${key} -ErrorAction SilentlyContinue`),
    ].join('\n');
  }
  if (shell === 'cmd') {
    return [`set "PATH=${shimDir};%PATH%"`, ...values.map(([key, value]) => `set "${key}=${value || ''}"`)].join('\r\n');
  }
  if (shell === 'bash' || shell === 'zsh' || shell === 'sh') {
    return [
      `case ":$PATH:" in *:${quoteSh(shimDir)}:*) ;; *) export PATH=${quoteSh(shimDir)}:"$PATH" ;; esac`,
      ...values.map(([key, value]) => value ? `export ${key}=${quoteSh(value)}` : `unset ${key}`),
    ].join('\n');
  }
  throw new Error(`不支持的 shell: ${shell}`);
}

export function renderShellInit(shell = process.platform === 'win32' ? 'powershell' : 'bash') {
  if (shell === 'powershell' || shell === 'pwsh') {
    return `$script:SdkctlCommand = if (Get-Command sdkctl-core.exe -ErrorAction SilentlyContinue) { (Get-Command sdkctl-core.exe).Source } else { (Get-Command sdkctl.cmd -ErrorAction Stop).Source }
function global:sdk {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]] $SdkArgs)
  if ($SdkArgs.Count -gt 0 -and $SdkArgs[0] -eq 'use') { & $script:SdkctlCommand @SdkArgs --hook }
  else { & $script:SdkctlCommand @SdkArgs }
  $sdkctlExitCode = $LASTEXITCODE
  if ($sdkctlExitCode -eq 0 -and $SdkArgs.Count -gt 0 -and $SdkArgs[0] -in @('use', 'remove', 'rm')) {
    $sdkctlEnvironment = & $script:SdkctlCommand env --shell powershell
    if ($LASTEXITCODE -eq 0) { Invoke-Expression ($sdkctlEnvironment -join [Environment]::NewLine) }
  }
  $global:LASTEXITCODE = $sdkctlExitCode
}
$sdkctlEnvironment = & $script:SdkctlCommand env --shell powershell
if ($LASTEXITCODE -eq 0) { Invoke-Expression ($sdkctlEnvironment -join [Environment]::NewLine) }`;
  }
  if (shell === 'bash' || shell === 'zsh' || shell === 'sh') {
    return `sdk() {
  if [ "$1" = use ]; then command sdkctl "$@" --hook; else command sdkctl "$@"; fi
  local sdkctl_exit_code=$?
  case "$1" in use|remove|rm) [ $sdkctl_exit_code -eq 0 ] && eval "$(command sdkctl env --shell bash)" ;; esac
  return $sdkctl_exit_code
}
eval "$(command sdkctl env --shell bash)"`;
  }
  throw new Error(`不支持 shell hook: ${shell}`);
}
