# =====================================================================
#  Shoeb Motors & Tyre House  -  Local Server (NO INSTALL NEEDED)
#  Works on Windows PowerShell 5.1 (built into Windows 10/11)
#  Listens on http://localhost:PORT/  ->  no admin rights required
#  Saves data to the offline folder selected by setup.bat
# =====================================================================
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appDir     = Join-Path (Split-Path -Parent $scriptDir) 'app'
$cloudConfigPath = Join-Path $scriptDir 'cloud.private.json'
$dataPathFile = Join-Path $scriptDir 'data-path.txt'
$portFile = Join-Path $scriptDir 'server-port.txt'

function Write-Line($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }

Write-Host ''
Write-Line '==========================================================' 'DarkYellow'
Write-Line '   SHOEB MOTORS & TYRE HOUSE   -   Shop Manager (Local)' 'Yellow'
Write-Line '==========================================================' 'DarkYellow'
Write-Host ''

# ---------- 1. Configured offline data folder ----------
function Test-FolderWritable($path) {
    try {
        if (-not $path) { return $false }
        if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
        $probe = Join-Path $path ('.write-test-' + [System.Guid]::NewGuid().ToString('N'))
        Set-Content -LiteralPath $probe -Value 'ok' -Encoding ASCII
        Remove-Item -LiteralPath $probe -Force
        return $true
    } catch { return $false }
}

# ALL business data lives in ONE fixed folder, whatever folder the software / .bat files are kept in.
$configuredDir = 'D:\Private\Do Not Delete'
try { if ($env:SHOEB_DATA_DIR) { $configuredDir = [string]$env:SHOEB_DATA_DIR } } catch { }
$dataDir = ''
$dataSource = 'configured path'
if (Test-FolderWritable $configuredDir) { $dataDir = $configuredDir }

$backupDir = ''
$latestGoodFile = ''
$deletedDir = ''
$stateFile = ''
$loginTrustFile = ''
$cloudPendingFile = ''
$onlineBackupMetaFile = ''
$folderNames = @('invoices', 'stocks', 'customers')
if ($dataDir -ne '') {
    $backupDir = Join-Path $dataDir 'backups'
    $latestGoodFile = Join-Path $backupDir 'latest-good.json'
    $deletedDir = Join-Path $dataDir 'deleted'
    $stateFile = Join-Path $dataDir 'data.json'
    $loginTrustFile = Join-Path $dataDir '.login-trusted'
    $cloudPendingFile = Join-Path $dataDir 'cloud-pending.json' # legacy only; no auto retry
    $onlineBackupMetaFile = Join-Path $dataDir 'manual-online-backup.json'
    foreach ($d in @($dataDir, $backupDir, $deletedDir)) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
    }
    foreach ($fn in $folderNames) {
        $fp = Join-Path $dataDir $fn
        if (-not (Test-Path -LiteralPath $fp)) { New-Item -ItemType Directory -Force -Path $fp | Out-Null }
    }
}

function Convert-ToJsonList($arr, $depth = 40) {
    # PowerShell-এ এক-আইটেমের তালিকা JSON-এ অ্যারে না হয়ে অবজেক্ট হয়ে যায় —
    # তাই হাতে করে [ ... ] বানানো হয়, যাতে ফাইল পড়তে/ব্যবহার করতে ভুল না হয়
    $items = @($arr)
    if ($items.Count -eq 0) { return '[]' }
    if ($items.Count -eq 1) { return ('[' + ($items[0] | ConvertTo-Json -Depth $depth) + ']') }
    return ($items | ConvertTo-Json -Depth $depth)
}

function Write-JsonFile($file, $data) {
    try {
        $text = if ($null -eq $data) { 'null' } else { $data | ConvertTo-Json -Depth 40 }
        [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    } catch { }
}

function Write-Folders($jsonText) {
    if (-not $dataDir) { return }
    try {
        $st = $jsonText | ConvertFrom-Json
        if (-not $st) { return }
        Ensure-Dirs
        $wanted = New-Object System.Collections.Generic.HashSet[string]
        $sales = @()
        if ($st.PSObject.Properties.Name -contains 'sales' -and $st.sales) { $sales = @($st.sales) }
        foreach ($sale in $sales) {
            $nm = ''
            foreach ($k in @('invoiceNo', 'no', 'id')) {
                if ($sale.PSObject.Properties.Name -contains $k -and $sale.$k) { $nm = [string]$sale.$k; break }
            }
            if (-not $nm) { $nm = 'invoice' }
            $nm = ($nm -replace '[\\/:*?"<>|]+', '-').Trim()
            if ($nm.Length -gt 80) { $nm = $nm.Substring(0, 80) }
            $fname = $nm + '.json'
            [void]$wanted.Add($fname)
            Write-JsonFile (Join-Path (Join-Path $dataDir 'invoices') $fname) $sale
        }
        # তালিকা থেকে সরে যাওয়া ইনভয়েসের পুরনো ফাইল সরানো
        try {
            Get-ChildItem -LiteralPath (Join-Path $dataDir 'invoices') -Filter '*.json' -File | ForEach-Object {
                if (-not $wanted.Contains($_.Name)) { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
            }
        } catch { }
        $listMap = @{ 'stocks' = 'products'; 'customers' = 'customers' }
        foreach ($k in $listMap.Keys) {
            $val = @()
            if ($st.PSObject.Properties.Name -contains $listMap[$k] -and $st.($listMap[$k])) { $val = @($st.($listMap[$k])) }
            $text = Convert-ToJsonList $val
            try { [System.IO.File]::WriteAllText((Join-Path (Join-Path $dataDir $k) ($k + '.json')), $text, (New-Object System.Text.UTF8Encoding($false))) } catch { }
        }
        if ($st.PSObject.Properties.Name -contains 'settings') {
            Write-JsonFile (Join-Path $dataDir 'settings.json') $st.settings
        }
    } catch { }
}

function Ensure-Dirs {
    if (-not $dataDir) { return }
    foreach ($d in @($dataDir, $backupDir, $deletedDir)) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
    }
    foreach ($fn in $folderNames) {
        $fp = Join-Path $dataDir $fn
        if (-not (Test-Path -LiteralPath $fp)) { New-Item -ItemType Directory -Force -Path $fp | Out-Null }
    }
}

function Get-TrustedLogin {
    try { return [bool]($loginTrustFile -and (Test-Path -LiteralPath $loginTrustFile)) } catch { return $false }
}
function Set-TrustedLogin([bool]$on) {
    if (-not $loginTrustFile) { return $false }
    try {
        if ($on) { [System.IO.File]::WriteAllText($loginTrustFile, 'trusted', (New-Object System.Text.UTF8Encoding($false))) }
        elseif (Test-Path -LiteralPath $loginTrustFile) { Remove-Item -LiteralPath $loginTrustFile -Force }
        return $true
    } catch { return $false }
}

# ---------- Windows auto-start helpers ----------
$autoStartRegPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$autoStartRegName = 'Shoeb Motors'
$legacyAutoStartLink = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\Shoeb Motors Auto Start.lnk'

function Get-AutoStartStatus {
    $registry = $false
    $legacy = $false
    try {
        $v = Get-ItemProperty -Path $autoStartRegPath -Name $autoStartRegName -ErrorAction Stop
        if ($null -ne $v.$autoStartRegName) { $registry = $true }
    } catch { }
    try { $legacy = Test-Path -LiteralPath $legacyAutoStartLink } catch { }
    return [ordered]@{ supported = $true; enabled = ($registry -or $legacy); registry = $registry; legacy = $legacy }
}

function Disable-AutoStart {
    $registryRemoved = $false
    $legacyRemoved = $false
    try {
        Remove-ItemProperty -Path $autoStartRegPath -Name $autoStartRegName -Force -ErrorAction Stop
        $registryRemoved = $true
    } catch { }
    try {
        if (Test-Path -LiteralPath $legacyAutoStartLink) {
            Remove-Item -LiteralPath $legacyAutoStartLink -Force -ErrorAction Stop
            $legacyRemoved = $true
        }
    } catch { }
    $st = Get-AutoStartStatus
    return [ordered]@{ ok = (-not $st.enabled); enabled = $st.enabled; registryRemoved = $registryRemoved; legacyRemoved = $legacyRemoved }
}

# ---------- 2. Helpers ----------
$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8';  '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
    '.png'  = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'; '.ico' = 'image/x-icon'; '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
    '.pdf' = 'application/pdf'; '.webp' = 'image/webp'
}

function Send-Text($response, $text, $status = 200, $contentType = 'text/plain; charset=utf-8') {
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
        $response.StatusCode = $status
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch { }
    finally { try { $response.OutputStream.Close() } catch { } }
}


function Get-PdfBrowser {
    $c = New-Object System.Collections.Generic.List[string]
    if ($env:SHOEB_PDF_BROWSER) { [void]$c.Add([string]$env:SHOEB_PDF_BROWSER) }
    foreach ($p in @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    )) { if ($p) { [void]$c.Add($p) } }
    foreach ($n in @('msedge.exe','chrome.exe')) { try { $x=(Get-Command $n -ErrorAction Stop).Source; if($x){[void]$c.Add($x)} } catch {} }
    foreach ($x in $c) { try { if ($x -and (Test-Path -LiteralPath $x)) { return $x } } catch {} }
    return ''
}
function Get-FileDataUri($file, $mimeType) {
    try { return ('data:'+$mimeType+';base64,'+[Convert]::ToBase64String([IO.File]::ReadAllBytes($file))) } catch { return '' }
}
function Get-SelfContainedPdfHtml($inner, $layout) {
    $css=''; try { $css=[IO.File]::ReadAllText((Join-Path $appDir 'css\style.css')) } catch {}
    $reg=Get-FileDataUri (Join-Path $appDir 'fonts\NotoSansBengali-Regular.woff2') 'font/woff2'
    $bold=Get-FileDataUri (Join-Path $appDir 'fonts\NotoSansBengali-Bold.woff2') 'font/woff2'
    if($reg){ $css=$css.Replace('url("../fonts/NotoSansBengali-Regular.woff2")','url("'+$reg+'")') }
    if($bold){ $css=$css.Replace('url("../fonts/NotoSansBengali-Bold.woff2")','url("'+$bold+'")') }
    $css=$css -replace 'font-display:\s*swap','font-display:block'
    $h=[regex]::Replace([string]$inner,'<script\b[\s\S]*?<\/script>','',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach($it in @(@('logo-print.jpg','image/jpeg'),@('logo-thermal.jpg','image/jpeg'),@('logo.png','image/png'))){
        $u=Get-FileDataUri (Join-Path $appDir ('img\'+$it[0])) $it[1]
        if($u){ $h=$h.Replace('src="img/'+$it[0]+'"','src="'+$u+'"').Replace("src='img/"+$it[0]+"'",'src="'+$u+'"') }
    }
    $lay=if($layout -eq 'a5'){'a5'}elseif($layout -eq '80'){'80'}else{'a4'}
    $pg=if($lay -eq 'a5'){'A5 portrait'}elseif($lay -eq '80'){'80mm auto'}else{'A4 portrait'}
    $mg=if($lay -eq '80'){'2mm'}else{'4mm'}
    return '<!doctype html><html><head><meta charset="utf-8"><style>'+$css+' @page{size:'+$pg+';margin:'+$mg+'}html,body{margin:0!important;padding:0!important;background:#fff!important}body{color:#111}</style></head><body class="print-'+$lay+'"><div class="print-root">'+$h+'</div></body></html>'
}
function New-VectorPdfBytes($inner, $layout) {
    $browser=Get-PdfBrowser; if(-not $browser){ throw 'Microsoft Edge or Google Chrome was not found' }
    $tmp=Join-Path ([IO.Path]::GetTempPath()) ('shoeb-pdf-'+[Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $htmlFile=Join-Path $tmp 'document.html'; $pdfFile=Join-Path $tmp 'document.pdf'; $profile=Join-Path $tmp 'profile'
    New-Item -ItemType Directory -Force -Path $profile | Out-Null
    try {
        [IO.File]::WriteAllText($htmlFile,(Get-SelfContainedPdfHtml $inner $layout),(New-Object Text.UTF8Encoding($false)))
        $uri='file:///'+($htmlFile.Replace('\','/').Replace(' ','%20'))
        $tries=@('--headless=new','--headless')
        foreach($headless in $tries){
            if(Test-Path -LiteralPath $pdfFile){Remove-Item -LiteralPath $pdfFile -Force -ErrorAction SilentlyContinue}
            $args=@($headless,'--disable-gpu','--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check','--disable-extensions','--virtual-time-budget=1500',('--user-data-dir="'+$profile+'"'),'--no-pdf-header-footer',('--print-to-pdf="'+$pdfFile+'"'),$uri)
            try {
                $p=Start-Process -FilePath $browser -ArgumentList $args -WindowStyle Hidden -PassThru -ErrorAction Stop
                if(-not $p.WaitForExit(20000)){ try{$p.Kill()}catch{} }
            } catch { $p=$null }
            if((Test-Path -LiteralPath $pdfFile) -and ((Get-Item -LiteralPath $pdfFile).Length -gt 500)){ return [IO.File]::ReadAllBytes($pdfFile) }
        }
        throw 'PDF generation failed'
    } finally { try { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue } catch {} }
}

function Send-File($response, $fullPath) {
    if (-not (Test-Path -LiteralPath $fullPath)) { Send-Text $response 'Not found' 404; return }
    $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
    $type = $mime[$ext]
    if (-not $type) { $type = 'application/octet-stream' }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $response.StatusCode = 200
        $response.ContentType = $type
        $response.ContentLength64 = $bytes.Length
        $response.Headers['Cache-Control'] = 'no-store'
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch { }
    finally { try { $response.OutputStream.Close() } catch { } }
}

function Read-Body($request) {
    $reader = New-Object System.IO.StreamReader($request.InputStream, (New-Object System.Text.UTF8Encoding($false)), $true)
    $text = $reader.ReadToEnd()
    $reader.Close()
    return $text
}

function Prune-Backups($folder, $keep = 60) {
    try {
        $files = Get-ChildItem -LiteralPath $folder -Filter 'data-*.json' -File | Sort-Object LastWriteTime -Descending
        if ($files.Count -gt $keep) { $files | Select-Object -Skip $keep | Remove-Item -Force }
    } catch { }
}


# ---------- Private online backend (Google Apps Script via local proxy) ----------
function Get-CloudConfig {
    try {
        if (-not (Test-Path -LiteralPath $cloudConfigPath)) { return $null }
        $c = Get-Content -LiteralPath $cloudConfigPath -Raw | ConvertFrom-Json
        if ($c.enabled -and $c.appsScriptUrl -and $c.secret) { return $c }
    } catch { }
    return $null
}

function Invoke-CloudBackend($action, $stateObj = $null) {
    $c = Get-CloudConfig
    if (-not $c) { return $null }
    $payload = [ordered]@{ action = $action; secret = [string]$c.secret }
    if ($null -ne $stateObj) { $payload.state = $stateObj }
    $body = $payload | ConvertTo-Json -Depth 60 -Compress
    try {
        return Invoke-RestMethod -Uri ([string]$c.appsScriptUrl) -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec $(if ($action -eq 'ping') { 5 } elseif ($action -eq 'pull') { 20 } else { 45 })
    } catch { return $null }
}

function Get-StateStamp($jsonText) {
    try {
        if (-not $jsonText -or $jsonText.Trim().Length -lt 3) { return [DateTimeOffset]::MinValue }
        $o = $jsonText | ConvertFrom-Json
        if ($o.meta -and $o.meta.updatedAt) { return [DateTimeOffset]::Parse([string]$o.meta.updatedAt) }
        if ($o.meta -and $o.meta.createdAt) { return [DateTimeOffset]::Parse([string]$o.meta.createdAt) }
    } catch { }
    return [DateTimeOffset]::MinValue
}

function Get-StateSeq($obj) {
    try { if ($obj -and $obj.meta -and $null -ne $obj.meta.saveSeq) { return [int64]$obj.meta.saveSeq } } catch { }
    return 0
}
function Get-StateLineage($obj) {
    try { if ($obj -and $obj.meta -and $obj.meta.createdAt) { return [string]$obj.meta.createdAt } } catch { }
    return ''
}
function Write-ConflictSnapshot($obj, $reason) {
    try {
        Ensure-Dirs
        $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ss-fffZ')
        $file = Join-Path $deletedDir ($stamp + '__conflict-state.json')
        $payload = [ordered]@{ type='conflict-state'; at=(Get-Date).ToUniversalTime().ToString('o'); reason=[string]$reason; data=$obj }
        $text = $payload | ConvertTo-Json -Depth 80 -Compress
        $tmp = $file + '.tmp.' + [System.Guid]::NewGuid().ToString('N')
        $enc = New-Object System.Text.UTF8Encoding($false)
        $bytes = $enc.GetBytes($text)
        $fs = New-Object System.IO.FileStream($tmp, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $fs.Write($bytes,0,$bytes.Length); $fs.Flush($true) } finally { $fs.Dispose() }
        Move-Item -LiteralPath $tmp -Destination $file -Force
        return [System.IO.Path]::GetFileName($file)
    } catch { return '' }
}

function Write-StateTextAtomic($text) {
    if (-not $dataDir) { throw 'Save folder is not available.' }
    if (-not $text -or $text.Trim().Length -lt 3) { throw 'State is empty.' }
    Ensure-Dirs
    $tmp = Join-Path $dataDir ('data.tmp.' + [System.Guid]::NewGuid().ToString('N'))
    try {
        [System.IO.File]::WriteAllText($tmp, $text, (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $tmp -Destination $stateFile -Force
    } catch {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
        throw
    }
}

function Write-LatestGoodBackup($text) {
    if (-not $latestGoodFile) { return }
    $tmp = $latestGoodFile + '.tmp.' + [System.Guid]::NewGuid().ToString('N')
    $fs = $null
    try {
        $enc = New-Object System.Text.UTF8Encoding($false)
        $bytes = $enc.GetBytes($text)
        $fs = New-Object System.IO.FileStream($tmp, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $fs.Write($bytes, 0, $bytes.Length)
        $fs.Flush($true)
        $fs.Dispose(); $fs = $null
        Move-Item -LiteralPath $tmp -Destination $latestGoodFile -Force
    } catch {
        if ($null -ne $fs) { try { $fs.Dispose() } catch { } }
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
}

function Save-LocalStateText($text) {
    if (-not $dataDir) { return }
    if (-not $text -or $text.Trim().Length -lt 3) { return }
    # Cloud restore/reconcile must never destroy the only copy of the current offline state.
    # Preserve it first so a bad clock/conflict can always be rolled back manually.
    try {
        if (Test-Path -LiteralPath $stateFile) {
            $before = [System.IO.File]::ReadAllText($stateFile)
            if ($before -and $before.Trim().Length -gt 3 -and $before -ne $text) {
                $null = $before | ConvertFrom-Json
                Copy-Item -LiteralPath $stateFile -Destination (Join-Path $backupDir ('data-cloud-before-' + (Get-Date -Format 'yyyy-MM-dd-HHmmss') + '.json')) -Force
                Prune-Backups $backupDir 60
            }
        }
    } catch { }
    Write-StateTextAtomic $text
    Write-LatestGoodBackup $text
    Write-Folders $text
}

function Get-ValidLocalStateText {
    if (-not $dataDir) { return '{}' }
    if (Test-Path -LiteralPath $stateFile) {
        try {
            $txt = [System.IO.File]::ReadAllText($stateFile)
            if ($txt -and $txt.Trim().Length -gt 3) { $null = $txt | ConvertFrom-Json; return $txt }
        } catch { }
    }
    try {
        $candidates = @()
        if ($latestGoodFile -and (Test-Path -LiteralPath $latestGoodFile)) { $candidates += Get-Item -LiteralPath $latestGoodFile }
        $candidates += @(Get-ChildItem -LiteralPath $backupDir -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne 'latest-good.json' -and ($_.Name -eq 'last-version.json' -or $_.Name -like 'data-*.json') } |
            Sort-Object LastWriteTime -Descending)
        foreach ($f in $candidates) {
            try {
                $txt = [System.IO.File]::ReadAllText($f.FullName)
                if (-not $txt -or $txt.Trim().Length -le 3) { continue }
                $null = $txt | ConvertFrom-Json
                Write-StateTextAtomic $txt
                Write-Folders $txt
                Write-Line ("  Recovery    :  restored data from " + $f.Name) 'Yellow'
                return $txt
            } catch { }
        }
    } catch { }
    return '{}'
}

function Get-ReconciledStateText { return (Get-ValidLocalStateText) }

try { if ($cloudPendingFile -and (Test-Path -LiteralPath $cloudPendingFile)) { Remove-Item -LiteralPath $cloudPendingFile -Force -ErrorAction SilentlyContinue } } catch { }

# ---------- 3. Start listening ----------
# Main shop app is intentionally local-only. Remote owner viewing is cloud-based
# through Google Apps Script + Supabase; the shop server stays local-only.
$ports = @($Port, 8081, 8082, 8090, 8181, 8123)
$started = $false
$activePort = $Port

foreach ($p in $ports) {
    if ($started) { break }
    try {
        $l = New-Object System.Net.HttpListener
        $l.Prefixes.Add("http://localhost:$p/")
        $l.Start()
        $listener = $l; $activePort = $p; $started = $true
        break
    } catch { continue }
}

if (-not $started) {
    Write-Line '(!) No free port found (8080, 8081, 8082, 8090, 8181, 8123 are busy).' 'Red'
    Write-Line '    Close the other copy of the program and try again.' 'DarkGray'
    Read-Host 'Press Enter to exit'
    exit 1
}

try { [System.IO.File]::WriteAllText($portFile, [string]$activePort, (New-Object System.Text.UTF8Encoding($false))) } catch { }

if ($dataDir) {
    Write-Line "  Data folder :  $dataDir" 'Green'
    Write-Line "                 (configured offline path)" 'DarkGray'
    Write-Line "  Backups     :  $backupDir" 'DarkGray'
    Write-Line "  Folders     :  invoices / stocks / customers" 'DarkGray'
} else {
    Write-Line '  Data folder :  NOT SET' 'Yellow'
    Write-Line '                 Data must be saved in D:\Private\Do Not Delete - make sure drive D: is connected.' 'DarkGray'
    Write-Line '  No shop data files will be written until the configured folder is writable.' 'DarkGray'
}
Write-Line "  Address     :  http://localhost:$activePort" 'Cyan'
Write-Host ''
Write-Line '  >>> KEEP THIS BLACK WINDOW OPEN WHILE USING THE SHOP <<<' 'Yellow'
Write-Line '  To close the shop manager, simply close this window.' 'DarkGray'
Write-Host ''

if (-not $NoBrowser) {
    if ($env:OS -eq 'Windows_NT') { try { Start-Process "http://localhost:$activePort/" } catch { } }
    elseif ($IsLinux) { try { & xdg-open "http://localhost:$activePort/" } catch { } }
}

# ---------- 4. Request loop ----------
try {
    while ($listener.IsListening) {
        $context = $null
        try { $context = $listener.GetContext() } catch { break }
        $request  = $context.Request
        $response = $context.Response
        $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)

        # ---- API ----
        if ($path -eq '/api/info') {
            $dirEsc = if ($dataDir) { $dataDir.Replace('\', '\\').Replace('"', '\"') } else { '' }
            $savedDirEsc = if ($configuredDir) { $configuredDir.Replace('\', '\\').Replace('"', '\"') } else { '' }
            $configuredJson = if ($dataDir) { 'true' } else { 'false' }
            $pathStatus = if ($dataDir) { 'ready' } elseif ($configuredDir) { 'unavailable' } else { 'not-set' }
            $trustedJson = if (Get-TrustedLogin) { 'true' } else { 'false' }
            $json = '{"ok":true,"mode":"server","server":"powershell","port":' + $activePort + ',"configured":' + $configuredJson + ',"dataDir":"' + $dirEsc + '","savedDataDir":"' + $savedDirEsc + '","pathStatus":"' + $pathStatus + '","trustedLogin":' + $trustedJson + ',"lan":false,"ips":[]}'
            Send-Text $response $json 200 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/login-trust/on' -and $request.HttpMethod -eq 'POST') {
            $ok = Set-TrustedLogin $true
            Send-Text $response $(if ($ok) { '{"ok":true,"trustedLogin":true}' } else { '{"ok":false}' }) $(if ($ok) { 200 } else { 500 }) 'application/json; charset=utf-8'
            continue
        }
        if ($path -eq '/api/login-trust/off' -and $request.HttpMethod -eq 'POST') {
            $ok = Set-TrustedLogin $false
            Send-Text $response $(if ($ok) { '{"ok":true,"trustedLogin":false}' } else { '{"ok":false}' }) $(if ($ok) { 200 } else { 500 }) 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/autostart' -and $request.HttpMethod -eq 'GET') {
            $st = Get-AutoStartStatus
            Send-Text $response ($st | ConvertTo-Json -Compress) 200 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/autostart/off' -and $request.HttpMethod -eq 'POST') {
            $st = Disable-AutoStart
            Send-Text $response ($st | ConvertTo-Json -Compress) $(if ($st.ok) { 200 } else { 500 }) 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/state' -and $request.HttpMethod -eq 'GET') {
            if (-not $dataDir) { Send-Text $response '{}' 200 'application/json; charset=utf-8'; continue }
            $localState = Get-ValidLocalStateText
            Send-Text $response $localState 200 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/cloud/status') {
            $c = Get-CloudConfig
            $last = ''
            try {
                if ($onlineBackupMetaFile -and (Test-Path -LiteralPath $onlineBackupMetaFile)) {
                    $m = Get-Content -LiteralPath $onlineBackupMetaFile -Raw | ConvertFrom-Json
                    if ($m.lastCompleteAt) { $last = [string]$m.lastCompleteAt }
                }
            } catch { }
            $localUpdated = ''
            $needsReminder = $false
            $pending = $false
            try {
                $lt = Get-ValidLocalStateText
                if ($lt -and $lt.Trim().Length -gt 3 -and $lt.Trim() -ne '{}') {
                    $lo = $lt | ConvertFrom-Json
                    if ($lo.meta -and $lo.meta.updatedAt) { $localUpdated = [string]$lo.meta.updatedAt }
                    if ($localUpdated) {
                        $lu = [DateTimeOffset]::Parse($localUpdated)
                        $bu = if ($last) { [DateTimeOffset]::Parse($last) } else { [DateTimeOffset]::MinValue }
                        $pending = $lu -gt $bu
                        $needsReminder = $pending -and ($lu.LocalDateTime.Date -lt (Get-Date).Date)
                    }
                }
            } catch { }
            $out = [ordered]@{ ok=$true; enabled=[bool]$c; manualOnly=$true; pending=$pending; busy=$false; needsReminder=$needsReminder; localUpdatedAt=$localUpdated; lastCompleteAt=$last; lastComplete=[bool]$last }
            Send-Text $response ($out | ConvertTo-Json -Compress) 200 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/cloud/push' -and $request.HttpMethod -eq 'POST') {
            $c = Get-CloudConfig
            if (-not $c) { Send-Text $response '{"ok":false,"manualOnly":true,"error":"online backend not configured"}' 503 'application/json; charset=utf-8'; continue }
            try {
                $txt = Get-ValidLocalStateText
                if (-not $txt -or $txt.Trim().Length -le 3 -or $txt.Trim() -eq '{}') {
                    Send-Text $response '{"ok":true,"complete":true,"manualOnly":true,"skipped":true}' 200 'application/json; charset=utf-8'
                    continue
                }
                $obj = $txt | ConvertFrom-Json
                $r = Invoke-CloudBackend 'push' $obj
                $complete = $r -and $r.ok -eq $true -and ($null -eq $r.complete -or $r.complete -eq $true)
                $recoverySafe = $complete -or ($r -and $r.supabase -eq $true -and $r.sheet -eq $true)
                if ($recoverySafe) {
                    $now = (Get-Date).ToUniversalTime().ToString('o')
                    if ($onlineBackupMetaFile) {
                        $stateUpdated = if ($obj.meta -and $obj.meta.updatedAt) { [string]$obj.meta.updatedAt } else { '' }
                        $meta = [ordered]@{ lastCompleteAt=$now; stateUpdatedAt=$stateUpdated }
                        [System.IO.File]::WriteAllText($onlineBackupMetaFile, ($meta | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
                    }
                    $out = [ordered]@{ ok=$true; complete=$complete; recoverySafe=$true; manualOnly=$true; lastCompleteAt=$now; supabase=[bool]$r.supabase; sheet=[bool]$r.sheet }
                    Send-Text $response ($out | ConvertTo-Json -Compress) 200 'application/json; charset=utf-8'
                } else {
                    Send-Text $response '{"ok":false,"complete":false,"recoverySafe":false,"manualOnly":true,"error":"online backup failed - manual retry required"}' 502 'application/json; charset=utf-8'
                }
            } catch { Send-Text $response '{"ok":false,"complete":false,"manualOnly":true,"error":"online backup failed - manual retry required"}' 502 'application/json; charset=utf-8' }
            continue
        }

        if ($path -eq '/api/cloud/restore' -and $request.HttpMethod -eq 'POST') {
            $c = Get-CloudConfig
            if (-not $c) { Send-Text $response '{"ok":false,"manualOnly":true,"error":"online backup is not configured"}' 503 'application/json; charset=utf-8'; continue }
            try {
                $body = Read-Body $request
                $ask = if ($body) { $body | ConvertFrom-Json } else { $null }
                if (-not $ask -or $ask.confirm -ne $true) { Send-Text $response '{"ok":false,"error":"explicit restore confirmation required"}' 400 'application/json; charset=utf-8'; continue }
                $r = Invoke-CloudBackend 'pull' $null
                $remote = if ($r) { $r.state } else { $null }
                $valid = $r -and $r.ok -eq $true -and $remote -and $remote.settings -and ($null -ne $remote.products -or $null -ne $remote.sales -or $null -ne $remote.customers)
                if (-not $valid) { throw 'No valid full online backup was found. Local data was not changed.' }
                $text = $remote | ConvertTo-Json -Depth 80 -Compress
                Save-LocalStateText $text
                $now = (Get-Date).ToUniversalTime().ToString('o')
                if ($onlineBackupMetaFile) {
                    $meta = [ordered]@{ lastCompleteAt=$now; stateUpdatedAt=$(if ($remote.meta -and $remote.meta.updatedAt) { [string]$remote.meta.updatedAt } else { '' }) }
                    [System.IO.File]::WriteAllText($onlineBackupMetaFile, ($meta | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
                }
                $out = [ordered]@{ ok=$true; restored=$true; manualOnly=$true; source=$(if($r.source){[string]$r.source}else{'online'}); products=@($remote.products).Count; customers=@($remote.customers).Count; sales=@($remote.sales).Count; receipts=@($remote.receipts).Count; expenses=@($remote.expenses).Count; dayClosings=@($remote.dayClosings).Count }
                Send-Text $response ($out | ConvertTo-Json -Compress) 200 'application/json; charset=utf-8'
            } catch {
                Send-Text $response (([ordered]@{ok=$false;manualOnly=$true;error=[string]$_.Exception.Message}) | ConvertTo-Json -Compress) 502 'application/json; charset=utf-8'
            }
            continue
        }
        if ($path -eq '/api/cloud/pull' -and $request.HttpMethod -eq 'POST') {
            Send-Text $response '{"ok":false,"manualOnly":true,"error":"cloud pull is disabled except explicit disaster-recovery restore"}' 405 'application/json; charset=utf-8'
            continue
        }

        if ($path -eq '/api/state' -and $request.HttpMethod -eq 'POST') {
            if (-not $dataDir) { Send-Text $response '{"ok":false,"error":"Save folder is not set. Choose it in Settings."}' 409 'application/json; charset=utf-8'; continue }
            $body = Read-Body $request
            if ($body -and $body.Trim().Length -gt 2) {
                try {
                    if (-not (Test-Path -LiteralPath $dataDir)) { New-Item -ItemType Directory -Force -Path $dataDir | Out-Null }
                    if (-not (Test-Path -LiteralPath $backupDir)) { New-Item -ItemType Directory -Force -Path $backupDir | Out-Null }
                    $incoming = $body | ConvertFrom-Json
                    $currentText = Get-ValidLocalStateText
                    $current = $null
                    try { if ($currentText -and $currentText.Trim().Length -gt 3) { $current = $currentText | ConvertFrom-Json } } catch { $current = $null }
                    $baseText = [string]$request.Headers['X-Shoeb-Base-Seq']
                    $baseSeq = 0L; $hasBase = [int64]::TryParse($baseText, [ref]$baseSeq)
                    $allowReplace = ([string]$request.Headers['X-Shoeb-Allow-Replace'] -eq '1')
                    if (-not $allowReplace -and $current -and $hasBase) {
                        $currentSeq = Get-StateSeq $current
                        $sameLineage = ((Get-StateLineage $incoming) -and ((Get-StateLineage $incoming) -eq (Get-StateLineage $current)))
                        $exactRetry = $sameLineage -and ((Get-StateSeq $incoming) -eq $currentSeq) -and ($currentText -eq $body)
                        $staleSeq = $sameLineage -and ($baseSeq -ne $currentSeq)
                        $wrongLineage = ((Get-StateLineage $current) -and (Get-StateLineage $incoming) -and ((Get-StateLineage $current) -ne (Get-StateLineage $incoming)))
                        if ($exactRetry) {
                            Send-Text $response ('{"ok":true,"saved":true,"duplicate":true,"savedSeq":' + $currentSeq + '}') 200 'application/json; charset=utf-8'
                            continue
                        }
                        if ($staleSeq -or $wrongLineage) {
                            $rf = Write-ConflictSnapshot $incoming $(if ($staleSeq) { 'stale-save-sequence' } else { 'state-lineage-mismatch' })
                            $safeRf = ([string]$rf).Replace('\','\\').Replace('"','\"')
                            Send-Text $response ('{"ok":false,"conflict":true,"error":"Newer data already exists. Rejected stale save to prevent overwrite.","currentSeq":' + $currentSeq + ',"recoveryFile":"' + $safeRf + '"}') 409 'application/json; charset=utf-8'
                            continue
                        }
                    }
                    # Fast local-first save. No cloud, retry queue, rotating backup or full mirror rebuild.
                    Write-StateTextAtomic $body
                    Send-Text $response ('{"ok":true,"saved":true,"savedSeq":' + (Get-StateSeq $incoming) + '}') 200 'application/json; charset=utf-8' 
                } catch {
                    Send-Text $response ('{"ok":false,"error":"' + ($_.Exception.Message -replace '"', "'") + '"}') 500 'application/json; charset=utf-8'
                }
            } else {
                Send-Text $response '{"ok":false,"error":"empty body"}' 400 'application/json; charset=utf-8'
            }
            continue
        }

        if ($path -eq '/api/archive' -and $request.HttpMethod -eq 'POST') {
            if (-not $dataDir) { Send-Text $response '{"ok":false,"error":"Save folder is not set."}' 409 'application/json; charset=utf-8'; continue }
            $body = Read-Body $request
            try {
                $j = $body | ConvertFrom-Json
                if (-not $j -or -not $j.name) { Send-Text $response '{"ok":false,"error":"name missing"}' 400 'application/json; charset=utf-8'; continue }
                if (-not (Test-Path -LiteralPath $deletedDir)) { New-Item -ItemType Directory -Force -Path $deletedDir | Out-Null }
                $safe = ([string]$j.name) -replace '[^\w.\-]+', '_'
                if ($safe.Length -gt 120) { $safe = $safe.Substring(0, 120) }
                $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ss-fffZ')
                $file = Join-Path $deletedDir ($stamp + '__' + $safe + '.json')
                $text = if ($j.data) { $j.data | ConvertTo-Json -Depth 40 } else { '{}' }
                [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
                Send-Text $response ('{"ok":true,"file":"' + [System.IO.Path]::GetFileName($file) + '"}') 200 'application/json; charset=utf-8'
            } catch {
                Send-Text $response ('{"ok":false,"error":"' + ($_.Exception.Message -replace '"', "'") + '"}') 500 'application/json; charset=utf-8'
            }
            continue
        }

        if ($path -eq '/api/pdf' -and $request.HttpMethod -eq 'POST') {
            try {
                $body=Read-Body $request
                $j=if($body){$body|ConvertFrom-Json}else{$null}
                if(-not $j -or -not $j.html){ Send-Text $response '{"ok":false,"error":"PDF content missing"}' 400 'application/json; charset=utf-8'; continue }
                $layout=if($j.layout -eq 'a5'){'a5'}elseif($j.layout -eq '80'){'80'}else{'a4'}
                $name=[string]$j.filename; if(-not $name){$name='Shoeb-Motors.pdf'}
                $name=($name -replace '[\\/:*?"<>|]+','-'); if($name -notmatch '\.pdf$'){$name+='.pdf'}
                [byte[]]$bytes=New-VectorPdfBytes ([string]$j.html) $layout
                $response.StatusCode=200; $response.ContentType='application/pdf'; $response.ContentLength64=$bytes.Length
                $response.Headers['Content-Disposition']='attachment; filename="'+$name+'"'; $response.Headers['Cache-Control']='no-store'; $response.Headers['X-Shoeb-PDF-Mode']='vector-browser'
                $response.OutputStream.Write($bytes,0,$bytes.Length); $response.OutputStream.Close()
            } catch { Send-Text $response (([ordered]@{ok=$false;error=[string]$_.Exception.Message})|ConvertTo-Json -Compress) 503 'application/json; charset=utf-8' }
            continue
        }
        if ($path -eq '/api/backup' -and $request.HttpMethod -eq 'GET') {
            if (-not $dataDir) { Send-Text $response '{"ok":false,"error":"Save folder is not set."}' 409 'application/json; charset=utf-8'; continue }
            if (Test-Path -LiteralPath $stateFile) {
                $bytes = [System.IO.File]::ReadAllBytes($stateFile)
                $response.StatusCode = 200
                $response.ContentType = 'application/json; charset=utf-8'
                $response.ContentLength64 = $bytes.Length
                $response.Headers['Content-Disposition'] = 'attachment; filename="shoeb-motors-backup-' + (Get-Date -Format 'yyyy-MM-dd-HHmm') + '.json"'
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Close()
            } else { Send-Text $response '{}' 200 'application/json; charset=utf-8' }
            continue
        }
        if ($path -eq '/api/open-folder') {
            if (-not $dataDir) { Send-Text $response '{"ok":false,"error":"Save folder is not set."}' 409 'application/json; charset=utf-8'; continue }
            if ($env:OS -eq 'Windows_NT') { try { Start-Process explorer.exe $dataDir } catch { } }
            Send-Text $response '{"ok":true}' 200 'application/json; charset=utf-8'
            continue
        }

        # ---- Static files ----
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
        $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        if ($rel -match '\.\.') { Send-Text $response 'Bad request' 400; continue }
        $full = Join-Path $appDir $rel
        if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full 'index.html' }
        Send-File $response $full
    }
} finally {
    try { $listener.Stop(); $listener.Close() } catch { }
    Write-Line '' 'Gray'
    if ($dataDir) {
        Write-Line 'Server stopped. Your data is safe in:' 'Yellow'
        Write-Line "  $dataDir" 'Green'
    } else {
        Write-Line 'Server stopped. No save folder had been selected.' 'Yellow'
    }
    Start-Sleep -Seconds 2
}
