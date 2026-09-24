# Shoeb Motors - ONE fixed permanent data folder.
# Shared setup data-folder helper (dot-sourced).
#
#   ALL business data (database, invoices, stock, customers, settings, backups)
#   is saved in:   D:\Private\Do Not Delete
#   no matter which folder the software / the .bat files are kept in.
#
# Old data folders (for example D:\ShoebMotors-Data, <extract folder>\Data,
# D:\Private\Do Not Delete Data) are COPIED across when they hold newer data.
# The old folders are never deleted or changed.

$script:FixedDataDir = 'D:\Private\Do Not Delete'

function Read-DataText([string]$Path) {
    try {
        if ($Path -and (Test-Path -LiteralPath $Path)) {
            return ([IO.File]::ReadAllText($Path)).Replace([string][char]0xFEFF, '').Trim()
        }
    } catch { }
    return ''
}

function Test-DirWritable([string]$Dir) {
    try {
        if (-not $Dir) { return $false }
        New-Item -ItemType Directory -Force -Path $Dir -ErrorAction Stop | Out-Null
        $t = Join-Path $Dir ('.setup-' + [Guid]::NewGuid().ToString('N') + '.tmp')
        [IO.File]::WriteAllText($t, 'ok')
        Remove-Item -LiteralPath $t -Force
        return $true
    } catch { return $false }
}

function Test-HasData([string]$Dir) {
    if (-not $Dir -or -not (Test-Path -LiteralPath $Dir)) { return $false }
    foreach ($f in @('shoeb.db', 'data.json')) {
        $p = Join-Path $Dir $f
        if ((Test-Path -LiteralPath $p) -and ((Get-Item -LiteralPath $p).Length -gt 3)) { return $true }
    }
    return $false
}

function Get-DataStamp([string]$Dir) {
    $best = [DateTime]::MinValue
    foreach ($f in @('shoeb.db', 'shoeb.db-wal', 'data.json')) {
        $p = Join-Path $Dir $f
        if (Test-Path -LiteralPath $p) {
            $t = (Get-Item -LiteralPath $p).LastWriteTime
            if ($t -gt $best) { $best = $t }
        }
    }
    return $best
}

function Get-NormalPath([string]$Path) {
    try { return ([IO.Path]::GetFullPath($Path)).TrimEnd('\').ToLowerInvariant() } catch { return ([string]$Path).TrimEnd('\').ToLowerInvariant() }
}

# Makes sure D:\Private\Do Not Delete exists and holds the newest data found on this PC.
# The local server must already be stopped when this runs.
# Returns an object with .DataDir and .MigratedFrom ('' when nothing had to be copied).
function Initialize-PermanentDataFolder {
    param([string]$RootDir, [string]$StateDir, [string]$ServerDir)

    $target = $script:FixedDataDir
    $drive = [IO.Path]::GetPathRoot($target)
    if (-not (Test-Path -LiteralPath $drive)) {
        throw ('Drive D: was not found on this PC. Shoeb Motors saves ALL data in  ' + $target + '  so drive D: must be connected. Nothing was changed.')
    }
    if (-not (Test-DirWritable $target)) {
        throw ('Cannot write to  ' + $target + '  . Check that the folder is not read-only. Nothing was changed.')
    }

    # Every place older versions may have used for data.
    $raw = @()
    $raw += (Read-DataText (Join-Path $StateDir 'data-dir.txt'))
    if ($ServerDir) { $raw += (Read-DataText (Join-Path $ServerDir 'data-path.txt')) }
    if ($RootDir) {
        $raw += (Join-Path $RootDir 'Data')
        $raw += (Join-Path $RootDir 'ShoebMotors-Data')
        $par = Split-Path -Parent $RootDir
        if ($par) { $raw += (Join-Path $par 'Data'); $raw += (Join-Path $par 'ShoebMotors-Data') }
    }
    $prevRoot = Read-DataText (Join-Path $StateDir 'install-root.txt')
    if ($prevRoot) {
        $raw += (Join-Path $prevRoot 'Data')
        $raw += (Join-Path $prevRoot 'ShoebMotors-Data')
        $ppar = Split-Path -Parent $prevRoot
        if ($ppar) { $raw += (Join-Path $ppar 'ShoebMotors-Data') }
    }
    $raw += 'D:\ShoebMotors-Data'
    $raw += 'D:\Private\Do Not Delete Data'
    if ($env:SystemDrive) {
        $raw += (Join-Path $env:SystemDrive 'ShoebMotors-Data')
        $raw += (Join-Path $env:SystemDrive 'Private\Do Not Delete Data')
    }
    if ($env:USERPROFILE) {
        $raw += (Join-Path $env:USERPROFILE 'ShoebMotors-Data')
        $raw += (Join-Path $env:USERPROFILE 'Private\Do Not Delete Data')
    }

    $tNorm = Get-NormalPath $target
    $seen = @{}
    $sources = @()
    foreach ($c in $raw) {
        if (-not $c) { continue }
        $n = Get-NormalPath $c
        if ($seen.ContainsKey($n)) { continue }
        $seen[$n] = $true
        if ($n -eq $tNorm) { continue }
        if ($n.StartsWith($tNorm + '\') -or $tNorm.StartsWith($n + '\')) { continue }
        if (Test-HasData $c) { $sources += $c }
    }

    $migratedFrom = ''
    if ($sources.Count -gt 0) {
        $best = $sources | Sort-Object { Get-DataStamp $_ } -Descending | Select-Object -First 1
        $bestStamp = Get-DataStamp $best
        $targetHas = Test-HasData $target
        $targetStamp = [DateTime]::MinValue
        if ($targetHas) { $targetStamp = Get-DataStamp $target }

        if ((-not $targetHas) -or ($bestStamp -gt $targetStamp)) {
            Write-Host ('[DATA] Copying data to the permanent folder: ' + $best + '  ->  ' + $target) -ForegroundColor DarkGray
            if ($targetHas) {
                # Safety copy of whatever is already in the permanent folder, so nothing can be lost.
                $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
                $safe = Join-Path (Join-Path $target 'backups') ('before-move-' + $stamp)
                New-Item -ItemType Directory -Force -Path $safe | Out-Null
                & robocopy.exe $target $safe /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
                if ($LASTEXITCODE -ge 8) { throw 'Could not make a safety copy of the current data folder. Nothing was changed.' }
                Write-Host ('[DATA] Safety copy of the current folder: ' + $safe) -ForegroundColor DarkGray
            }
            # A leftover SQLite journal from the old file must not be paired with the new database file.
            foreach ($j in @('shoeb.db-wal', 'shoeb.db-shm')) {
                Remove-Item -LiteralPath (Join-Path $target $j) -Force -ErrorAction SilentlyContinue
            }
            & robocopy.exe $best $target /E /COPY:DAT /DCOPY:T /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
            if ($LASTEXITCODE -ge 8) { throw 'Existing data could not be copied to the permanent data folder. Nothing was deleted.' }
            $migratedFrom = $best
        }
    }

    return [pscustomobject]@{ DataDir = $target; MigratedFrom = $migratedFrom }
}
