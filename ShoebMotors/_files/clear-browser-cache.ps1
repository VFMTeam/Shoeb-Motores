$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
Write-Host '[CACHE] Clearing browser cache and old Shoeb Motors browser storage...' -ForegroundColor DarkGray

# Stop only old Shoeb Motors background-server processes so the old local port can be used
# briefly to clear origin-scoped browser data before the real app starts again.
try {
    $needles = @('server.js','server.ps1','run-server.cmd','server-background.vbs')
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $cl=[string]$_.CommandLine
        if(-not $cl -or $cl.IndexOf('ShoebMotors',[StringComparison]::OrdinalIgnoreCase) -lt 0){return $false}
        foreach($n in $needles){if($cl.IndexOf($n,[StringComparison]::OrdinalIgnoreCase) -ge 0){return $true}}
        return $false
    } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
} catch {}
Start-Sleep -Milliseconds 200

# Clear ordinary HTTP/code/GPU caches for common browsers. Cookies, passwords and history are NOT removed.
$cacheRoots = @(
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'),
    (Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\User Data')
)
foreach($root in $cacheRoots){
    if(-not (Test-Path -LiteralPath $root)){continue}
    try {
        Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' } | ForEach-Object {
            foreach($rel in @('Cache','Code Cache','GPUCache','Service Worker\CacheStorage','Service Worker\ScriptCache')){
                $p=Join-Path $_.FullName $rel
                if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue}
            }
        }
    } catch {}
}
$ffRoot=Join-Path $env:APPDATA 'Mozilla\Firefox\Profiles'
if(Test-Path -LiteralPath $ffRoot){
    Get-ChildItem -LiteralPath $ffRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        foreach($rel in @('cache2','startupCache')){
            $p=Join-Path $_.FullName $rel
            if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue}
        }
    }
}

function Read-Text([string]$p){try{if(Test-Path -LiteralPath $p){return ([IO.File]::ReadAllText($p)).Trim()}}catch{};return ''}
$ports = New-Object System.Collections.Generic.List[int]
$ports.Add(17832)
try {
    $stateDir=Join-Path $env:LOCALAPPDATA 'ShoebMotors'
    $prev=Read-Text (Join-Path $stateDir 'install-root.txt')
    if($prev){
        $pf=Read-Text (Join-Path $prev 'App\program\server\fixed-port.txt'); $n=0
        if([int]::TryParse($pf,[ref]$n) -and $n -ge 1025 -and $n -le 65535 -and -not $ports.Contains($n)){$ports.Add($n)}
    }
} catch {}

# Serve a tiny one-use page on the exact local origin(s). The page clears ONLY that Shoeb Motors
# origin's localStorage/sessionStorage/CacheStorage/service worker/IndexedDB, so other websites'
# cookies/passwords/history are untouched.
function Clear-Origin([int]$Port,[string]$HostName){
    $listener=$null
    try {
        $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
        $listener.Start()
    } catch { if($listener){try{$listener.Stop()}catch{}}; return $false }
    try {
        $url=('http://'+$HostName+':'+$Port+'/__shoeb_clear__?t='+(Get-Date).Ticks)
        Start-Process $url | Out-Null
        $deadline=(Get-Date).AddSeconds(7); $done=$false
        while((Get-Date) -lt $deadline -and -not $done){
            if(-not $listener.Pending()){Start-Sleep -Milliseconds 80;continue}
            $client=$listener.AcceptTcpClient(); $stream=$client.GetStream(); $reader=[IO.StreamReader]::new($stream,[Text.Encoding]::ASCII,$false,1024,$true)
            $first=$reader.ReadLine(); while($true){$ln=$reader.ReadLine();if($null -eq $ln -or $ln -eq ''){break}}
            $path='/'
            if($first -match '^\w+\s+([^\s]+)'){ $path=$Matches[1] }
            if($path -like '/__shoeb_done__*'){
                $body='OK'; $bytes=[Text.Encoding]::UTF8.GetBytes($body)
                $hdr="HTTP/1.1 200 OK`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
                $hb=[Text.Encoding]::ASCII.GetBytes($hdr);$stream.Write($hb,0,$hb.Length);$stream.Write($bytes,0,$bytes.Length);$done=$true
            } else {
                $html=@'
<!doctype html><meta charset="utf-8"><title>Shoeb Motors Cache Clear</title>
<body style="font-family:Segoe UI,Arial;padding:30px"><b>Shoeb Motors cache পরিষ্কার হচ্ছে…</b>
<script>
(async function(){
 try{localStorage.clear();}catch(e){}
 try{sessionStorage.clear();}catch(e){}
 try{if(window.caches){for(const k of await caches.keys()) await caches.delete(k);}}catch(e){}
 try{if(navigator.serviceWorker){for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();}}catch(e){}
 try{if(indexedDB && indexedDB.databases){for(const d of await indexedDB.databases()){if(d&&d.name) try{indexedDB.deleteDatabase(d.name);}catch(e){}}}}catch(e){}
 try{await fetch('/__shoeb_done__?h='+encodeURIComponent(location.hostname),{cache:'no-store'});}catch(e){}
 document.body.innerHTML='<b>Shoeb Motors browser cache পরিষ্কার হয়েছে।</b><br>Setup এখন software খুলবে।';
 setTimeout(function(){try{window.close();}catch(e){}},500);
})();
</script></body>
'@
                $bytes=[Text.Encoding]::UTF8.GetBytes($html)
                $hdr="HTTP/1.1 200 OK`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store, no-cache, must-revalidate`r`nPragma: no-cache`r`nConnection: close`r`n`r`n"
                $hb=[Text.Encoding]::ASCII.GetBytes($hdr);$stream.Write($hb,0,$hb.Length);$stream.Write($bytes,0,$bytes.Length)
            }
            $reader.Dispose();$stream.Dispose();$client.Close()
        }
        return $done
    } catch { return $false }
    finally { if($listener){try{$listener.Stop()}catch{}} }
}

foreach($p in @($ports | Select-Object -Unique)){
    [void](Clear-Origin $p '127.0.0.1')
    [void](Clear-Origin $p 'localhost')
}
Write-Host '[CACHE] Cache cleanup step finished.' -ForegroundColor DarkGray
exit 0
