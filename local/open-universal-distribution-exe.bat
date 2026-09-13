@echo off
setlocal EnableExtensions
REM Open latest Universal + Distribution setup EXEs from local build output.
REM Looks in: dist-installers\updates\  and  apps\launcher\src-tauri\target\release\bundle\nsis\
cd /d "%~dp0\.."
set "REPO=%CD%"
set "UPDATES=%REPO%\dist-installers\updates"
set "NSIS=%REPO%\apps\launcher\src-tauri\target\release\bundle\nsis"

echo.
echo ============================================
echo  Open Universal + Distribution EXE (local)
echo ============================================
echo.

set "UNI="
set "DIST="

REM Prefer copied artifacts in dist-installers\updates
for /f "delims=" %%F in ('dir /b /a-d /o-d "%UPDATES%\POPS-Universal-Management-System_*_x64-setup.exe" 2^>nul') do (
  if not defined UNI set "UNI=%UPDATES%\%%F"
)
for /f "delims=" %%F in ('dir /b /a-d /o-d "%UPDATES%\Medical-Distribution-System_*_x64-setup.exe" 2^>nul') do (
  if not defined DIST set "DIST=%UPDATES%\%%F"
)

REM Fallback: fresh NSIS output
if not defined UNI (
  for /f "delims=" %%F in ('dir /b /a-d /o-d "%NSIS%\*Universal*_x64-setup.exe" 2^>nul') do (
    if not defined UNI set "UNI=%NSIS%\%%F"
  )
)
if not defined DIST (
  for /f "delims=" %%F in ('dir /b /a-d /o-d "%NSIS%\*Distribution*_x64-setup.exe" 2^>nul') do (
    if not defined DIST set "DIST=%NSIS%\%%F"
  )
)

if defined UNI (
  echo Universal: %UNI%
  start "" "%UNI%"
) else (
  echo Universal EXE not found. Build with: pnpm installer:universal
)

if defined DIST (
  echo Distribution: %DIST%
  start "" "%DIST%"
) else (
  echo Distribution EXE not found. Build with: pnpm installer:distribution
)

echo.
if exist "%UPDATES%" (
  echo Opening folder: %UPDATES%
  explorer "%UPDATES%"
) else if exist "%NSIS%" (
  echo Opening folder: %NSIS%
  explorer "%NSIS%"
) else (
  echo No local installer folders yet. Run a build first.
)

echo.
pause
exit /b 0
