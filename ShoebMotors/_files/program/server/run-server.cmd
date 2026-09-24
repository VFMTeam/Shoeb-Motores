@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "HERE=%~dp0"

if not defined SHOEB_PORT (
  if exist "%HERE%fixed-port.txt" set /p SHOEB_PORT=<"%HERE%fixed-port.txt"
)
if not defined SHOEB_PORT set "SHOEB_PORT=17832"
set "SHOEB_NO_BROWSER=1"

:boot
rem Prefer Node when it is actually able to parse this server. If Node exits,
rem automatically fall through to the PowerShell backend instead of restart-looping forever.
where node >nul 2>nul
if not errorlevel 1 (
  node --check "%HERE%server.js" >nul 2>nul
  if not errorlevel 1 (
    echo [%date% %time%] Starting Node backend on port %SHOEB_PORT%...
    node "%HERE%server.js"
    set "NODE_RC=%ERRORLEVEL%"
    echo [%date% %time%] Node backend exited with code !NODE_RC!. Trying PowerShell fallback...
  ) else (
    echo [%date% %time%] Installed Node cannot parse server.js. Trying PowerShell fallback...
  )
)

where powershell >nul 2>nul
if not errorlevel 1 (
  echo [%date% %time%] Starting Windows PowerShell backend on port %SHOEB_PORT%...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%server.ps1" -Port %SHOEB_PORT% -NoBrowser
  set "PS_RC=%ERRORLEVEL%"
  echo [%date% %time%] Windows PowerShell backend exited with code !PS_RC!.
)

where pwsh >nul 2>nul
if not errorlevel 1 (
  echo [%date% %time%] Starting PowerShell backend on port %SHOEB_PORT%...
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%HERE%server.ps1" -Port %SHOEB_PORT% -NoBrowser
  set "PWSH_RC=%ERRORLEVEL%"
  echo [%date% %time%] PowerShell backend exited with code !PWSH_RC!.
)

if defined SHOEB_NO_RESTART exit /b 1
>nul 2>nul ping 127.0.0.1 -n 2
goto :boot
