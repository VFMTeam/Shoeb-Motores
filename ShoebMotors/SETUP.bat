@echo off
setlocal
chcp 65001 >nul 2>nul

rem Clear browser cache + old Shoeb Motors browser-origin storage before setup.
rem This does NOT delete D:\Private\Do Not Delete business data.
if exist "%~dp0_files\clear-browser-cache.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_files\clear-browser-cache.ps1"
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_files\install.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Setup failed. Please keep this window open and send a screenshot of the error.
  pause
)
exit /b %RC%
