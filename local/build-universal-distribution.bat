@echo off
setlocal EnableExtensions
REM Fast Universal (suite) + Distribution signed EXEs + auto-update manifests.
cd /d "%~dp0\.."

call "%~dp0set-build-live-api.bat"

set "MSVC_ROOT=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
set "MSVC_VER=14.44.35207"
set "SDK_VER=10.0.26100.0"
set "KITS=C:\Program Files (x86)\Windows Kits\10"

set "PATH=%USERPROFILE%\.cargo\bin;%ProgramFiles%\nodejs;%APPDATA%\npm;%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\bin\Hostx64\x64;%KITS%\bin\%SDK_VER%\x64;%SystemRoot%\System32;%SystemRoot%;%PATH%"
set "LIB=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\lib\x64;%KITS%\Lib\%SDK_VER%\um\x64;%KITS%\Lib\%SDK_VER%\ucrt\x64"
set "INCLUDE=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\include;%KITS%\Include\%SDK_VER%\ucrt;%KITS%\Include\%SDK_VER%\um;%KITS%\Include\%SDK_VER%\shared;%KITS%\Include\%SDK_VER%\winrt"

if exist "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe" (
  copy /Y "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe" "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe" >nul 2>&1
)

set "CARGO_TARGET_DIR=%TEMP%\pops-launcher-cargo-target"
set "CARGO_BUILD_JOBS=%NUMBER_OF_PROCESSORS%"
set "CARGO_INCREMENTAL=1"

set "TAURI_SIGNING_PRIVATE_KEY_PATH=%USERPROFILE%\.tauri\pops-updater.key"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="
if not exist "%TAURI_SIGNING_PRIVATE_KEY_PATH%" (
  echo Missing updater private key: %TAURI_SIGNING_PRIVATE_KEY_PATH%
  echo Run: cd apps\launcher ^& pnpm exec tauri signer generate -w "%USERPROFILE%\.tauri\pops-updater.key" --ci
  exit /b 1
)

if exist "%APPDATA%\npm\pnpm.cmd" (
  set "PNPM=%APPDATA%\npm\pnpm.cmd"
) else if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
  set "PNPM=%LOCALAPPDATA%\pnpm\pnpm.exe"
) else (
  set "PNPM=pnpm"
)

set "OUT_DIR=%~dp0..\dist-installers"
mkdir "%CARGO_TARGET_DIR%" 2>nul
mkdir "%OUT_DIR%" 2>nul

cd /d "%~dp0\..\apps\launcher"

echo.
echo === BUILD 1/2: Universal (suite) + updater sig ===
set "PLATFORM_EDITION=suite"
call %PNPM% exec node .\scripts\build-edition.mjs suite
if errorlevel 1 (
  echo BUILD FAILED: suite
  exit /b 1
)
call :COPY_INSTALLERS SUITE

echo.
echo === BUILD 2/2: Distribution + updater sig ===
set "PLATFORM_EDITION=distribution"
call %PNPM% exec node .\scripts\build-edition.mjs distribution
if errorlevel 1 (
  echo BUILD FAILED: distribution
  exit /b 1
)
call :COPY_INSTALLERS DISTRIBUTION

echo.
echo === BOTH BUILDS COMPLETE ===
echo Update manifests: %OUT_DIR%\updates\
echo Next: local\publish-desktop-release.bat
exit /b 0

:COPY_INSTALLERS
if /I "%~1"=="SUITE" (
  for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*Universal*-setup.exe") do call :COPY_ONE "%%~fF"
  for %%F in ("%~dp0..\apps\launcher\src-tauri\target\release\bundle\nsis\*Universal*-setup.exe") do call :COPY_ONE "%%~fF"
) else (
  for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*Distribution*-setup.exe") do call :COPY_ONE "%%~fF"
  for %%F in ("%~dp0..\apps\launcher\src-tauri\target\release\bundle\nsis\*Distribution*-setup.exe") do call :COPY_ONE "%%~fF"
)
goto :eof

:COPY_ONE
set "SRC=%~1"
if not exist "%SRC%" exit /b 0
copy /Y "%SRC%" "%OUT_DIR%\" >nul
if exist "%SRC%.sig" copy /Y "%SRC%.sig" "%OUT_DIR%\" >nul
echo Copied %~nx1
goto :eof
