@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>nul
title Shoeb Motors - Stop Local Server

set "SHOPROOT=%~dp0"
set "SHOPROOT=%SHOPROOT:~0,-1%"
set "PORT=17832"
set "SHOEB_STOP_ROOT=%SHOPROOT%"
if exist "%SHOPROOT%\App\program\server\fixed-port.txt" (
  set /p PORT=<"%SHOPROOT%\App\program\server\fixed-port.txt"
)

echo.
echo ==============================================
echo   SHOEB MOTORS - STOP LOCAL SERVER
echo ==============================================
echo.
echo Stopping Shoeb Motors background server...

rem Disable Shoeb Motors background auto-start so it cannot come back after sign-in.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$run='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run';" ^
  "Remove-ItemProperty -Path $run -Name 'Shoeb Motors Background Server' -Force;" ^
  "Remove-ItemProperty -Path $run -Name 'Shoeb Motors' -Force;" ^
  "$legacy=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\Shoeb Motors Auto Start.lnk';" ^
  "Remove-Item -LiteralPath $legacy -Force;" ^
  "schtasks.exe /Delete /TN 'Shoeb Motors Auto Start' /F 2>$null | Out-Null;" ^
  "schtasks.exe /Delete /TN 'Shoeb Motors Local Server' /F 2>$null | Out-Null" >nul 2>nul

rem Kill only Shoeb Motors server/launcher process trees.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$root=[IO.Path]::GetFullPath($env:SHOEB_STOP_ROOT);" ^
  "$needles=@('server.js','server.ps1','run-server.cmd','server-background.vbs','start-silent.vbs');" ^
  "$procs=Get-CimInstance Win32_Process | Where-Object {" ^
  "  $cl=[string]$_.CommandLine; if(-not $cl){return $false};" ^
  "  $isShoeb=($cl.IndexOf($root,[StringComparison]::OrdinalIgnoreCase)-ge 0) -or ($cl.IndexOf('ShoebMotors',[StringComparison]::OrdinalIgnoreCase)-ge 0);" ^
  "  if(-not $isShoeb){return $false};" ^
  "  foreach($n in $needles){if($cl.IndexOf($n,[StringComparison]::OrdinalIgnoreCase)-ge 0){return $true}};" ^
  "  return $false" ^
  "};" ^
  "$ids=@($procs | Select-Object -ExpandProperty ProcessId -Unique);" ^
  "foreach($id in $ids){Start-Process taskkill.exe -ArgumentList @('/PID',[string]$id,'/T','/F') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue}" >nul 2>nul

rem Extra safety: if this app still owns its configured local port, stop that PID only
rem when its command line is clearly from Shoeb Motors.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$p=0; [void][int]::TryParse('%PORT%',[ref]$p); if($p -le 0){exit};" ^
  "$owners=@(Get-NetTCPConnection -LocalPort $p -State Listen | Select-Object -ExpandProperty OwningProcess -Unique);" ^
  "foreach($ownerPid in $owners){$w=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ownerPid); $cl=[string]$w.CommandLine; if($cl -and $cl.IndexOf('ShoebMotors',[StringComparison]::OrdinalIgnoreCase)-ge 0){Start-Process taskkill.exe -ArgumentList @('/PID',[string]$ownerPid,'/T','/F') -WindowStyle Hidden -Wait}}" >nul 2>nul

timeout /t 1 /nobreak >nul

echo.
echo Server stopped.
echo You can now close this window and delete the ShoebMotors folder from Explorer.
echo.

rem Move CMD's working directory outside ShoebMotors before exiting.
cd /d "%TEMP%" >nul 2>nul
timeout /t 2 /nobreak >nul
exit /b 0
