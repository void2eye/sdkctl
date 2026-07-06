@echo off
setlocal
cd /d "%~dp0"
call npm.cmd link
if errorlevel 1 exit /b %errorlevel%
for /f "usebackq delims=" %%P in (`npm.cmd prefix -g`) do set "SDKCTL_NPM_PREFIX=%%P"
if exist "%SDKCTL_NPM_PREFIX%\sdkctl.cmd" if exist "%SDKCTL_NPM_PREFIX%\sdkctl.ps1" del /q "%SDKCTL_NPM_PREFIX%\sdkctl.ps1"
if exist "%SDKCTL_NPM_PREFIX%\sdk.cmd" if exist "%SDKCTL_NPM_PREFIX%\sdk.ps1" del /q "%SDKCTL_NPM_PREFIX%\sdk.ps1"
call sdkctl.cmd init
if errorlevel 1 exit /b %errorlevel%
echo.
echo Installation complete. Next:
echo   sdkctl scan D:\SDK
echo   Add sdkctl shell-init to your PowerShell profile
