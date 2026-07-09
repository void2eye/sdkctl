# sdkctl

一个轻量、跨平台的本机 SDK 版本管理 CLI。它统一管理 Java、PHP、Go、Node.js、Python，也允许登记任意自定义 SDK。

## Windows 安装

运行 `sdkctl-setup-0.1.3-x64.exe`。安装向导默认选择 `D:\Software\sdkctl`，也可以自由修改目录。安装包面向所有用户，会请求管理员权限并自动配置系统 PATH 与 PowerShell 模块；目标电脑不需要预装 Node.js。

安装后新开 PowerShell，直接使用：

```powershell
sdk scan D:\SDK
sdk list
sdk use php 8.2
sdk use java 21
sdk use go 1.26
```

`sdk use` 会同时切换版本、重建 shim，并自动刷新当前 PowerShell 的 `JAVA_HOME`、`GOROOT`、`PHP_HOME` 等环境变量。用户不需要运行 `Invoke-Expression`。

在 CMD / Clink 中使用 `sdkctl use`，同样会自动刷新当前窗口：

```bat
sdkctl use java 17
sdkctl use php 8.2
sdkctl use go 1.26
```

## 命令

```text
sdk scan [目录...]               自动发现 SDK（默认扫描当前目录）
sdk add <sdk> <版本|auto> <目录>  手动登记版本
sdk list [sdk]                   查看版本库存
sdk use <sdk> <版本>             切换并刷新当前终端，支持唯一版本前缀
sdk current [sdk]                查看活动版本
sdk remove <sdk> <版本>          移除登记，不删除 SDK 文件
sdk doctor                       检查配置、PATH 和活动目录
```

数据默认保存在每位用户自己的 `~/.sdkctl`。设置 `SDKCTL_HOME` 可改变位置；`~/.sdkctl/bin` 中的 shim 会随切换自动重建。

## 源码开发安装

```powershell
cd D:\SDK\sdkctl
.\install.cmd
```

## Bash / Zsh

非 PowerShell 终端仍遵循对应 shell 的标准加载方式：

```bash
eval "$(sdkctl shell-init bash)"
sdk use go 1.26
```

## 友链

https://linux.do/
