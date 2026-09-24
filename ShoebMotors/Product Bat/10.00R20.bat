@echo off
setlocal
chcp 65001 >nul 2>nul
title Shoeb Motors - 10.00R20 Product Import

echo.
echo ============================================================
echo   SHOEB MOTORS - 10.00R20 PRODUCT LIST IMPORT
echo ============================================================
echo This adds the Product List 10.00R20 products to LOCAL data only.
echo Online backup is NOT changed until you use Online Backup/Sync in the app.
echo.

if not exist "%~dp0_import-products.ps1" (
  echo Import helper is missing: %~dp0_import-products.ps1
  pause
  exit /b 3
)
if not exist "%~dp010.00R20.csv" (
  echo Product file is missing: %~dp010.00R20.csv
  pause
  exit /b 3
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_import-products.ps1" -CsvPath "%~dp010.00R20.csv" -BatchName "10.00R20" -RequireOnlyThisBatch
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Finished. You can delete the whole "Product Bat" folder after checking the stock page.
) else (
  echo Nothing was changed if the import stopped during its safety check.
)
echo.
pause
exit /b %RC%
