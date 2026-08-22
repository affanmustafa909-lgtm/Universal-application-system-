@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ============================================
echo  POPS Local API + Postgres
echo  URL: http://127.0.0.1:3000
echo  This project only - no live / Railway API
echo ============================================
echo.

if exist "local\.env" (
  copy /Y "local\.env" ".env" >nul
  echo [OK] Copied local\.env -^> .env
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker not found. Install Docker Desktop, then retry.
  pause
  exit /b 1
)

echo.
echo [1/3] Starting Postgres (docker compose)...
docker compose up -d
if errorlevel 1 (
  echo [ERROR] docker compose failed.
  pause
  exit /b 1
)

echo.
echo [2/3] Waiting for Postgres...
timeout /t 5 /nobreak >nul

where pnpm >nul 2>&1
if errorlevel 1 (
  set "PNPM=corepack pnpm"
) else (
  set "PNPM=pnpm"
)

echo.
echo [3/3] Starting sibling backend-system API on :3000 ...
if exist "..\backend-system\package.json" (
  echo API starting from ..\backend-system  ^(outside Universal^)
  echo Keep this window OPEN.
  echo Web UI: run local\start-web.bat  ^(http://127.0.0.1:1420^)
  echo.
  call %PNPM% --dir "..\backend-system" --filter @platform/api start
) else (
  echo [ERROR] Sibling backend-system not found at ..\backend-system
  pause
  exit /b 1
)
pause
