$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$SourceProgram = Join-Path $PSScriptRoot 'program'
if (-not (Test-Path -LiteralPath $SourceProgram)) { throw 'Setup files are incomplete.' }

# Portable install: the extracted ShoebMotors folder itself is the permanent root.
# Example: extract anywhere as ...\ShoebMotors -> data stays in that same ShoebMotors\Data folder.
$RootDir = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$InstallRoot = Join-Path $RootDir 'App'
$InstallProgram = Join-Path $InstallRoot 'program'
$OldDataDir = Join-Path $RootDir 'Data'   # OLD location (inside the extracted folder) - only used to migrate from
$DataDir = ''                                 # NEW permanent location - chosen below, outside the App/extract folder
$StateDir = Join-Path $env:LOCALAPPDATA 'ShoebMotors'
$RootStateFile = Join-Path $StateDir 'install-root.txt'
$PrevRoot = ''
$PrevDataDir = ''

# PERMANENT DATA FOLDER (v12.10): business data is NOT kept inside the extracted /
# App folder any more. It always lives in  D:\Private\Do Not Delete  so re-extracting or
# replacing the software never touches it. Old data folders are copied across, never deleted.

# Preserve the old fixed bookmark port when possible.
$PreferredPort = 17832
try {
    $portFiles = @((Join-Path $InstallProgram 'server\fixed-port.txt'))
    if ($PrevRoot -and ($PrevRoot.TrimEnd('\') -ne $RootDir.TrimEnd('\'))) {
        $portFiles += (Join-Path $PrevRoot 'App\program\server\fixed-port.txt')
    }
    foreach ($oldPortFile in $portFiles) {
        if (Test-Path -LiteralPath $oldPortFile) {
            $n = 0
            if ([int]::TryParse(([IO.File]::ReadAllText($oldPortFile)).Trim(), [ref]$n) -and $n -ge 1025 -and $n -le 65535) {
                $PreferredPort = $n
                break
            }
        }
    }
} catch { }

# Stop previous Shoeb Motors local server copies. No browser window is touched.
try {
    $needles = @('server.js','server.ps1','run-server.cmd','start-silent.vbs','server-background.vbs')
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $cl = [string]$_.CommandLine
        if (-not $cl -or $cl.IndexOf('ShoebMotors',[StringComparison]::OrdinalIgnoreCase) -lt 0) { return $false }
        foreach ($n in $needles) { if ($cl.IndexOf($n,[StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true } }
        return $false
    } | ForEach-Object {
        try { Start-Process taskkill.exe -ArgumentList @('/PID',[string]$_.ProcessId,'/T','/F') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue } catch { }
    }
} catch { }
Start-Sleep -Milliseconds 250

# Remove old visible Start / Auto Start launchers and legacy startup entries.
try {
    $run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    foreach ($name in @('Shoeb Motors','Shoeb Motors Background Server')) {
        Remove-ItemProperty -Path $run -Name $name -Force -ErrorAction SilentlyContinue
    }
    $legacy = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\Shoeb Motors Auto Start.lnk'
    Remove-Item -LiteralPath $legacy -Force -ErrorAction SilentlyContinue
    & schtasks.exe /Delete /TN 'Shoeb Motors Auto Start' /F 2>$null | Out-Null
    & schtasks.exe /Delete /TN 'Shoeb Motors Local Server' /F 2>$null | Out-Null
} catch { }

# ---- Permanent data folder: ALWAYS  D:\Private\Do Not Delete  (whatever folder SETUP.bat is kept in) ----
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$DataPointer = Join-Path $StateDir 'data-dir.txt'
. (Join-Path $PSScriptRoot 'data-folder.ps1')
$DataInfo = Initialize-PermanentDataFolder -RootDir $RootDir -StateDir $StateDir -ServerDir (Join-Path $InstallProgram 'server')
$DataDir = $DataInfo.DataDir
$MigratedFrom = $DataInfo.MigratedFrom
[IO.File]::WriteAllText($DataPointer, $DataDir, $Utf8NoBom)
try {
    $readme = Join-Path $DataDir 'README-DATA.txt'
    if (-not (Test-Path -LiteralPath $readme)) {
        [IO.File]::WriteAllText($readme, ('Shoeb Motors - business data folder. Do NOT delete this folder.' + [Environment]::NewLine + 'Updating / re-installing the software never changes this folder.' + [Environment]::NewLine + 'Keep a copy of this folder on a pen drive for safety.'), $Utf8NoBom)
    }
} catch { }

New-Item -ItemType Directory -Force -Path $InstallProgram | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# Verify the data folder is writable before touching the app copy.
$probe = Join-Path $DataDir ('.setup-' + [Guid]::NewGuid().ToString('N') + '.tmp')
[IO.File]::WriteAllText($probe, 'ok', $Utf8NoBom)
Remove-Item -LiteralPath $probe -Force

& robocopy.exe $SourceProgram $InstallProgram /E /COPY:DAT /DCOPY:T /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Program files could not be installed.' }

# Remove obsolete launchers that may remain from an older installed version.
foreach ($old in @(
    (Join-Path $InstallRoot 'start.bat'),
    (Join-Path $InstallRoot 'auto-start-on.bat'),
    (Join-Path $InstallRoot 'auto-start-off.bat'),
    (Join-Path $InstallRoot 'cloud-fix.bat'),
    (Join-Path $InstallProgram 'start-silent.vbs')
)) { Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue }

$ServerDir = Join-Path $InstallProgram 'server'
$DataPathFile = Join-Path $ServerDir 'data-path.txt'
[IO.File]::WriteAllText($DataPathFile, $DataDir, $Utf8NoBom)

# Carry forward older LOCAL data only. This setup never contacts the cloud.
$SyncHelper = Join-Path $ServerDir 'storage-sync-once.ps1'
$CloudConfig = Join-Path $ServerDir 'cloud.private.json'
if (Test-Path -LiteralPath $SyncHelper) {
    & $SyncHelper -DataDir $DataDir -PreviousDataDir $PrevDataDir -CloudConfigPath $CloudConfig | Out-Null
}
Write-Host '[SETUP] Local data step finished. Starting local server...' -ForegroundColor DarkGray

# This PC/browser is trusted after one-time setup, so the PIN page does not flash on normal launches.
$TrustFile = Join-Path $DataDir '.login-trusted'
[IO.File]::WriteAllText($TrustFile, 'trusted', $Utf8NoBom)

# Pick one stable local port for the bookmark. Keep it on future setup runs whenever it is available.
function Test-FreePort([int]$Port) {
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener -ArgumentList ([System.Net.IPAddress]::Loopback), $Port
        $listener.Start()
        return $true
    } catch { return $false }
    finally { if ($listener) { try { $listener.Stop() } catch { } } }
}
$Port = 0
$candidates = @($PreferredPort,17832,17833,17834,17835,18832,18833,19832) | Select-Object -Unique
foreach ($p in $candidates) { if (Test-FreePort $p) { $Port = [int]$p; break } }
if (-not $Port) { throw 'No free local port was available for Shoeb Motors.' }
[IO.File]::WriteAllText((Join-Path $ServerDir 'fixed-port.txt'), [string]$Port, $Utf8NoBom)
[IO.File]::WriteAllText((Join-Path $ServerDir 'server-port.txt'), [string]$Port, $Utf8NoBom)

# Store install location for safe updates/migration.
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
[IO.File]::WriteAllText($RootStateFile, $RootDir, $Utf8NoBom)

# Keep only the small local server ready after Windows sign-in. It never auto-opens the browser.
# This is what makes the saved browser bookmark open immediately without Start.bat.
$Wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$BgLauncher = Join-Path $InstallProgram 'server-background.vbs'
$RunValue = '"' + $Wscript + '" "' + $BgLauncher + '"'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $RunKey -Force | Out-Null
New-ItemProperty -Path $RunKey -Name 'Shoeb Motors Background Server' -Value $RunValue -PropertyType String -Force | Out-Null

# Start the background server now. Clear the old log first so any setup failure shows only this run.
$LogFile = Join-Path $ServerDir 'server-log.txt'
try { [IO.File]::WriteAllText($LogFile, ('=== Setup server start ' + (Get-Date).ToString('s') + " ===`r`n"), $Utf8NoBom) } catch { }
Start-Process -FilePath $Wscript -ArgumentList @('"' + $BgLauncher + '"') -WindowStyle Hidden
# The Node backend binds explicitly to IPv4 loopback (127.0.0.1). On some Windows
# setups, 'localhost' resolves to IPv6 (::1) or is sent through a proxy, which can
# make Invoke-WebRequest time out even though the local server is already listening.
# Try direct loopback first, disable proxy use for the health request, and retain
# localhost as a fallback for the PowerShell HttpListener backend.
$CandidateUrls = @(
    ('http://127.0.0.1:' + $Port + '/'),
    ('http://localhost:' + $Port + '/')
)
$Url = $CandidateUrls[0]
$InfoUrl = $Url + 'api/info'
$Ready = $false
$LastHealthError = ''
function Test-ShoebHealth([string]$HealthUrl) {
    $resp = $null
    $reader = $null
    try {
        $req = [System.Net.HttpWebRequest]::Create($HealthUrl)
        $req.Method = 'GET'
        $req.Timeout = 1000
        $req.ReadWriteTimeout = 1000
        $req.Proxy = $null
        $resp = $req.GetResponse()
        if ([int]$resp.StatusCode -ne 200) { return $false }
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $content = $reader.ReadToEnd()
        return ($content -match '"mode"\s*:\s*"server"')
    } catch {
        $script:LastHealthError = $_.Exception.Message
        return $false
    } finally {
        if ($reader) { try { $reader.Dispose() } catch { } }
        if ($resp) { try { $resp.Dispose() } catch { } }
    }
}
# Normally this completes in well under a second. The longer ceiling is only for slower Windows/AV startup.
for ($i=0; $i -lt 120 -and -not $Ready; $i++) {
    foreach ($base in $CandidateUrls) {
        $candidateInfo = $base + 'api/info'
        if (Test-ShoebHealth $candidateInfo) {
            $Url = $base
            $InfoUrl = $candidateInfo
            $Ready = $true
            break
        }
    }
    if (-not $Ready) { Start-Sleep -Milliseconds 100 }
}
if (-not $Ready) {
    Write-Host ''
    Write-Host 'Local server startup log:' -ForegroundColor Yellow
    if (Test-Path -LiteralPath $LogFile) {
        try { Get-Content -LiteralPath $LogFile -Tail 50 | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray } } catch { }
    }
    if ($LastHealthError) { Write-Host ('Health check: ' + $LastHealthError) -ForegroundColor DarkGray }
    throw ('Local server did not become ready. Log: ' + $LogFile)
}

# Open the stable address only after the backend has confirmed it is ready.
$LaunchUrl = $Url
Start-Process $LaunchUrl
Write-Host ''
Write-Host 'SETUP COMPLETE' -ForegroundColor Green
Write-Host ('Save this browser address: ' + $Url) -ForegroundColor White
Write-Host ('Data stays here (separate from the software - safe to update): ' + $DataDir) -ForegroundColor White
if ($MigratedFrom) { Write-Host ('Old data was COPIED from: ' + $MigratedFrom + '  (left untouched as an extra backup)') -ForegroundColor DarkGray }
Write-Host 'Online backup is MANUAL ONLY. Normal work never auto-syncs.' -ForegroundColor DarkGray
Write-Host 'Next time, open the saved browser link. No Start BAT is needed.' -ForegroundColor DarkGray
Start-Sleep -Seconds 2
