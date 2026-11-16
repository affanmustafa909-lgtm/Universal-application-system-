@echo off
setlocal EnableExtensions
REM Publish signed desktop installers + latest-*.json to Zivra desktop update repo.
REM Usage: local\publish-desktop-release.bat [version] [edition|all]
REM Editions: suite | restaurant | general-store | pharmacy | education | mobizone | all
cd /d "%~dp0\.."

set "VER=%~1"
set "EDITION=%~2"
if "%EDITION%"=="" set "EDITION=all"
if "%VER%"=="" (
  for /f "delims=" %%J in ('node -e "console.log(require('./apps/launcher/package.json').version)"') do set "VER=%%J"
)

if exist "%APPDATA%\npm\pnpm.cmd" (
  set "PNPM=%APPDATA%\npm\pnpm.cmd"
) else if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
  set "PNPM=%LOCALAPPDATA%\pnpm\pnpm.exe"
) else (
  set "PNPM=pnpm"
)

echo Publishing desktop edition=%EDITION% version=%VER% via publish-desktop-update.mjs
cd /d "%~dp0\..\apps\launcher"
call %PNPM% exec node .\scripts\publish-desktop-update.mjs %EDITION% %VER%
if errorlevel 1 exit /b 1

echo.
echo Live Zivra update feeds:
echo   https://github.com/basir2353/zivra-desktop-updates/releases/latest/download/latest-suite.json
echo   https://github.com/basir2353/zivra-desktop-updates/releases/latest/download/latest-restaurant.json
echo   https://github.com/basir2353/zivra-desktop-updates/releases/latest/download/latest-general-store.json
echo   https://github.com/basir2353/zivra-desktop-updates/releases/latest/download/latest-pharmacy.json
echo   https://github.com/basir2353/zivra-desktop-updates/releases/latest/download/latest-education.json
echo   https://github.com/basir2353/zivra-desktop-updates/releases/latest/download/latest-mobizone.json
exit /b 0
