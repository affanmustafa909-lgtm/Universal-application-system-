@echo off
setlocal
REM Build Waiter, Rider, and Admin APKs (local API).
call "%~dp0build-waiter-apk.bat"
if errorlevel 1 exit /b 1
call "%~dp0build-rider-apk.bat"
if errorlevel 1 exit /b 1
call "%~dp0build-admin-apk.bat"
if errorlevel 1 exit /b 1
echo.
echo All APKs:
echo   apps\waiter-mobile\dist\pops-waiter-release.apk
echo   apps\waiter-mobile\dist\pops-rider-release.apk
echo   apps\waiter-mobile\dist\pops-admin-release.apk
endlocal
