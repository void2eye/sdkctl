@echo off
if /i "%~1"=="use" goto :refresh
if /i "%~1"=="remove" goto :refresh
if /i "%~1"=="rm" goto :refresh

"%~dp0sdkctl-core.exe" %*
exit /b %errorlevel%

:refresh
"%~dp0sdkctl-core.exe" %* --hook
set "SDKCTL_EXIT=%errorlevel%"
if not "%SDKCTL_EXIT%"=="0" exit /b %SDKCTL_EXIT%

set "SDKCTL_ENV_FILE=%TEMP%\sdkctl-env-%RANDOM%-%RANDOM%.cmd"
"%~dp0sdkctl-core.exe" env --shell cmd > "%SDKCTL_ENV_FILE%"
if errorlevel 1 (
    set "SDKCTL_EXIT=%errorlevel%"
    del /q "%SDKCTL_ENV_FILE%" >nul 2>&1
    exit /b %SDKCTL_EXIT%
)
call "%SDKCTL_ENV_FILE%"
del /q "%SDKCTL_ENV_FILE%" >nul 2>&1
set "SDKCTL_EXIT="
set "SDKCTL_ENV_FILE="
exit /b 0
