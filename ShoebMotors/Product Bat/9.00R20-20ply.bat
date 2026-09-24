@echo off
setlocal
chcp 65001 >nul 2>nul
title Shoeb Motors - 9.00R20-20ply Product Import

echo.
echo ============================================================
echo   SHOEB MOTORS - 9.00R20-20ply PRODUCT LIST IMPORT
echo ============================================================
echo This adds the selected Product List products to LOCAL stock only.
echo Existing Shoeb Motors code is not changed.
echo Online backup is NOT changed until you use Online Backup/Sync in the app.
echo.

if not exist "%~dp0_import-products.ps1" (
  echo Import helper is missing: %~dp0_import-products.ps1
  pause
  exit /b 3
)
if not exist "%~dp09.00R20-20ply.csv" (
  echo Product file is missing: %~dp09.00R20-20ply.csv
  pause
  exit /b 3
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_import-products.ps1" -CsvPath "%~dp09.00R20-20ply.csv" -BatchName "9.00R20-20ply"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Finished. Open/check the Stock page in Shoeb Motors.
  echo You can run Online Backup/Sync afterward to copy the local stock online.
) else (
  echo Import stopped. Existing local data was not overwritten by this BAT.
)
echo.
pause
exit /b %RC%
