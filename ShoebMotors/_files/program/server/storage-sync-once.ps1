param(
    [Parameter(Mandatory=$true)][string]$DataDir,
    [string]$PreviousDataDir = '',
    [string]$CloudConfigPath = ''
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Say([string]$Text) { Write-Host "[LOCAL] $Text" }
function Ensure-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

function Read-State([string]$Dir) {
    $out = [ordered]@{ valid=$false; text=''; obj=$null; stamp=[DateTimeOffset]::MinValue; file='' }
    if (-not $Dir) { return [pscustomobject]$out }
    $f = Join-Path $Dir 'data.json'; $out.file = $f
    if (-not (Test-Path -LiteralPath $f)) { return [pscustomobject]$out }
    try {
        $txt = [System.IO.File]::ReadAllText($f)
        if (-not $txt -or $txt.Trim().Length -le 3 -or $txt.Trim() -eq '{}') { return [pscustomobject]$out }
        $obj = $txt | ConvertFrom-Json
        if (-not $obj) { return [pscustomobject]$out }
        $out.valid=$true; $out.text=$txt; $out.obj=$obj
        try {
            $ts=$null
            if ($obj.meta -and $obj.meta.updatedAt) { $ts=[string]$obj.meta.updatedAt }
            elseif ($obj.meta -and $obj.meta.createdAt) { $ts=[string]$obj.meta.createdAt }
            if ($ts) { $out.stamp=[DateTimeOffset]::Parse($ts) }
        } catch {}
    } catch {}
    return [pscustomobject]$out
}

function Write-State([string]$Dir,[string]$Text) {
    Ensure-Dir $Dir
    $target=Join-Path $Dir 'data.json'
    $tmp=Join-Path $Dir ('data.local-migrate.'+[Guid]::NewGuid().ToString('N'))
    [System.IO.File]::WriteAllText($tmp,$Text,$Utf8NoBom)
    Move-Item -LiteralPath $tmp -Destination $target -Force
}

function Copy-SupportFiles([string]$From,[string]$To) {
    if (-not $From -or -not (Test-Path -LiteralPath $From)) { return }
    foreach ($name in @('invoices','stocks','customers','backups','deleted','Deleted Backup')) {
        $src=Join-Path $From $name
        if (Test-Path -LiteralPath $src) {
            $dst=Join-Path $To $name; Ensure-Dir $dst
            try { Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
    foreach ($name in @('settings.json','.login-trusted','manual-online-backup.json')) {
        $src=Join-Path $From $name
        if (Test-Path -LiteralPath $src) { try { Copy-Item -LiteralPath $src -Destination (Join-Path $To $name) -Force } catch {} }
    }
}

Ensure-Dir $DataDir
$target=Read-State $DataDir
$previous=Read-State $PreviousDataDir
if ($PreviousDataDir -and ($PreviousDataDir.TrimEnd('\') -ne $DataDir.TrimEnd('\')) -and $previous.valid) {
    if ((-not $target.valid) -or ($previous.stamp -gt $target.stamp)) {
        Write-State $DataDir $previous.text
        Copy-SupportFiles $PreviousDataDir $DataDir
        Say ('Previous LOCAL data migrated to ' + $DataDir + '.')
    }
}
# Remove old automatic-cloud retry residue from previous builds. It is intentionally
# NOT uploaded: manual online backup is the only network path in this build.
Remove-Item -LiteralPath (Join-Path $DataDir 'cloud-pending.json') -Force -ErrorAction SilentlyContinue
Say 'Local migration complete. No cloud pull/push was performed.'
exit 0
