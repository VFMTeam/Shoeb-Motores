param(
    [Parameter(Mandatory=$true)][string]$CsvPath,
    [string]$BatchName = 'Product Batch',
    [switch]$RequireOnlyThisBatch
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-TextFile([string]$Path) {
    try {
        if (Test-Path -LiteralPath $Path) { return ([IO.File]::ReadAllText($Path)).Replace([string][char]0xFEFF, '').Trim() }
    } catch { }
    return ''
}
function Norm([object]$Value) {
    $s = [string]$Value
    try { $s = $s.Normalize([Text.NormalizationForm]::FormC) } catch { }
    $s = $s.Replace([string][char]0x200B,'').Replace([string][char]0x200E,'').Replace([string][char]0x200F,'').Replace([string][char]0xFEFF,'')
    $s = [regex]::Replace($s.Trim(), '\s+', ' ')
    return $s.ToLowerInvariant()
}
function Is-TyreType([object]$Value) {
    $k = (Norm $Value).Replace(' ','').Replace('-','').Replace('_','')
    return (-not $k) -or @('tyre','tire','tyres','tires','টায়ার') -contains $k
}
function Ensure-Prop($Obj, [string]$Name, $Value) {
    if ($null -eq $Obj.PSObject.Properties[$Name]) { $Obj | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force }
}
function Get-Prop($Obj, [string]$Name, $Default=$null) {
    if ($null -eq $Obj) { return $Default }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p) { return $Default }
    return $p.Value
}
function New-DefaultState {
    $now = (Get-Date).ToString('o')
    return [pscustomobject][ordered]@{
        version = 1
        meta = [pscustomobject][ordered]@{ createdAt=$now; updatedAt=$now; saveSeq=0; shop='Shoeb Motors & Tyre House'; lastBackupDay='' }
        deleted = @()
        settings = [pscustomobject][ordered]@{
            shopName='Shoeb Motors & Tyre House'; tagline='এখানে টায়ার, টিউব, রিম, পলি ত্রিপল, রশি ও মটর গাড়ীর যাবতীয় যন্ত্রাংশ বিক্রয় করা হয়';
            address='কালীগঞ্জ, ঝিনাইদহ'; phone='০১৭১১-৭২৮৯৭৫, ০১৭১২-২৮১৭৭২'; logoImage=''; currency='৳'; invoicePrefix='INV';
            lowStockLevel=2; footerNote='বিক্রয় করা মাল ফেরত নেওয়া হয় না।'; thanksLine='ধন্যবাদ, আবার আসবেন।'; discountNote=''; lang='bn'; theme='system';
            shopNameBn='সোয়েব মটরস এন্ড টায়ার হাউস'; invoiceStatus=[pscustomobject]@{due='বাকি';paid='পরিশোধিত';partial='আংশিক পরিশোধিত'}; pin='2828'; setupDone=$true
        }
        products=@(); customers=@(); sales=@(); receipts=@(); payments=@(); expenses=@(); heldSales=@(); dayClosings=@()
        counters=[pscustomobject][ordered]@{ invoice=0; product=0; customer=0; payment=0; expense=0; vehicle=0 }
    }
}
function Fingerprint($Row) {
    $raw = 'ShoebProductBat-v1|' + (Norm $BatchName) + '|' + (Norm $Row.brand) + '|' + (Norm $Row.size) + '|' + (Norm $Row.model) + '|' + ([string]$Row.qty)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($raw)
        return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
    } finally { $sha.Dispose() }
}
function Product-IdentityMatch($P, $Row) {
    if (-not (Is-TyreType (Get-Prop $P 'type' ''))) { return $false }
    if ((Norm (Get-Prop $P 'brand' '')) -ne (Norm $Row.brand)) { return $false }
    if ((Norm (Get-Prop $P 'size' '')) -ne (Norm $Row.size)) { return $false }
    $want = Norm $Row.model
    $m = Norm (Get-Prop $P 'model' '')
    $d = Norm (Get-Prop $P 'description' '')
    $n = Norm (Get-Prop $P 'name' '')
    return ($m -eq $want -or $d -eq $want -or $n -eq $want)
}
function Product-Label($P) {
    $brand=[string](Get-Prop $P 'brand' '')
    $size=[string](Get-Prop $P 'size' '')
    $model=[string](Get-Prop $P 'model' '')
    $name=[string](Get-Prop $P 'description' (Get-Prop $P 'name' ''))
    $tail = $(if($model){$model}else{$name})
    return (@($brand,$size,$tail) | Where-Object { $_ -and $_.Trim() }) -join ' | '
}
function Http-GetText([string]$Uri) {
    $req = [Net.HttpWebRequest]::Create($Uri)
    $req.Method='GET'; $req.Timeout=3000; $req.ReadWriteTimeout=3000; $req.Proxy=$null
    $resp=$null; $reader=$null
    try {
        $resp=$req.GetResponse(); $reader=[IO.StreamReader]::new($resp.GetResponseStream(),[Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    } finally {
        if($reader){$reader.Dispose()}; if($resp){$resp.Dispose()}
    }
}
function Test-Health([string]$Base) {
    try { return ((Http-GetText ($Base+'api/info')) -match '"mode"\s*:\s*"server"') } catch { return $false }
}
function Http-PostState([string]$Uri,[string]$Json,[int64]$BaseSeq,[string]$Lineage) {
    $bytes=[Text.Encoding]::UTF8.GetBytes($Json)
    $req=[Net.HttpWebRequest]::Create($Uri)
    $req.Method='POST'; $req.ContentType='application/json; charset=utf-8'; $req.ContentLength=$bytes.Length
    $req.Timeout=12000; $req.ReadWriteTimeout=12000; $req.Proxy=$null
    $req.Headers['X-Shoeb-Base-Seq']=[string]$BaseSeq
    if($Lineage){$req.Headers['X-Shoeb-Lineage']=$Lineage}
    $stream=$req.GetRequestStream(); try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
    $resp=$null; $reader=$null
    try {
        $resp=$req.GetResponse(); $reader=[IO.StreamReader]::new($resp.GetResponseStream(),[Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    } catch [Net.WebException] {
        $r=$_.Exception.Response
        if($r){$rd=[IO.StreamReader]::new($r.GetResponseStream(),[Text.Encoding]::UTF8); try{$msg=$rd.ReadToEnd()}finally{$rd.Dispose();$r.Dispose()}; throw $msg}
        throw
    } finally { if($reader){$reader.Dispose()}; if($resp){$resp.Dispose()} }
}

Write-Host ''
Write-Host ('=== SHOEB MOTORS - ' + $BatchName + ' LOCAL PRODUCT IMPORT ===') -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $CsvPath)) { throw ('Product file not found: ' + $CsvPath) }
$rows = @(Import-Csv -LiteralPath $CsvPath)
if (-not $rows.Count) { throw 'The product file has no rows.' }
foreach($r in $rows) {
    $q=0.0
    if(-not [double]::TryParse(([string]$r.qty),[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$q) -or $q -le 0) { throw ('Invalid qty for ' + $r.model) }
    if(-not (Norm $r.brand) -or -not (Norm $r.size) -or -not (Norm $r.model)) { throw 'Every row needs brand, size, model and qty.' }
    $r.qty=$q
}
$expectedQty = ($rows | Measure-Object -Property qty -Sum).Sum
Write-Host ('[FILE] Products: ' + $rows.Count + '  |  Stock: ' + $expectedQty + ' pcs') -ForegroundColor DarkGray

$PackageRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$StateDir=Join-Path $env:LOCALAPPDATA 'ShoebMotors'
$prevRoot=Read-TextFile (Join-Path $StateDir 'install-root.txt')
$candidates=@((Join-Path $PackageRoot 'App'))
if($prevRoot){$candidates += (Join-Path $prevRoot 'App')}
$InstallRoot=''
foreach($c in $candidates){ if(Test-Path -LiteralPath (Join-Path $c 'program\server')){$InstallRoot=$c;break} }
if(-not $InstallRoot){ throw 'Shoeb Motors is not installed. Run SETUP.bat first.' }
$Program=Join-Path $InstallRoot 'program'
$ServerDir=Join-Path $Program 'server'
$Port=17832
$pf=Read-TextFile (Join-Path $ServerDir 'fixed-port.txt'); $pn=0
if([int]::TryParse($pf,[ref]$pn) -and $pn -ge 1025 -and $pn -le 65535){$Port=$pn}
$bases=@(('http://127.0.0.1:'+$Port+'/'),('http://localhost:'+$Port+'/'))
$Base=$bases | Where-Object { Test-Health $_ } | Select-Object -First 1
if(-not $Base){
    $wscript=Join-Path $env:WINDIR 'System32\wscript.exe'; $launcher=Join-Path $Program 'server-background.vbs'
    Start-Process -FilePath $wscript -ArgumentList @('"'+$launcher+'"') -WindowStyle Hidden
    for($i=0;$i -lt 80 -and -not $Base;$i++){
        Start-Sleep -Milliseconds 100
        $Base=$bases | Where-Object { Test-Health $_ } | Select-Object -First 1
    }
}
if(-not $Base){ throw 'Local Shoeb Motors server could not be started. Run SETUP.bat once, then try again.' }

$stateText=Http-GetText ($Base+'api/state')
$state=$null
try { if($stateText -and $stateText.Trim() -ne '{}'){$state=$stateText | ConvertFrom-Json} } catch { throw 'Local state is not valid JSON. Nothing was changed.' }
if($null -eq $state){$state=New-DefaultState}
Ensure-Prop $state 'products' @(); Ensure-Prop $state 'counters' ([pscustomobject]@{invoice=0;product=0;customer=0;payment=0;expense=0;vehicle=0})
Ensure-Prop $state 'meta' ([pscustomobject]@{}); Ensure-Prop $state.meta 'saveSeq' 0; Ensure-Prop $state.meta 'createdAt' ((Get-Date).ToString('o'))
Ensure-Prop $state 'stockImports' ([pscustomobject]@{rows=[pscustomobject]@{};log=@()})
Ensure-Prop $state.stockImports 'rows' ([pscustomobject]@{}); Ensure-Prop $state.stockImports 'log' @()
Ensure-Prop $state.counters 'product' 0
$products=@($state.products)

# First-batch safety: this 10.00R20 starter batch must not be mixed with unknown/test products.
if($RequireOnlyThisBatch -and $products.Count -gt 0){
    $extra=@()
    foreach($p in $products){
        $belongs=$false
        foreach($r in $rows){ if(Product-IdentityMatch $p $r){$belongs=$true;break} }
        if(-not $belongs){$extra += $p}
    }
    if($extra.Count -gt 0){
        Write-Host ''
        Write-Host ('SAFETY STOP: Local data already contains ' + $extra.Count + ' other product(s).') -ForegroundColor Yellow
        Write-Host 'They may be old/test products. This BAT will NOT mix or delete them.' -ForegroundColor Yellow
        $extra | Select-Object -First 25 | ForEach-Object { Write-Host ('  - ' + (Product-Label $_)) -ForegroundColor White }
        if($extra.Count -gt 25){Write-Host ('  ... and ' + ($extra.Count-25) + ' more') -ForegroundColor DarkGray}
        Write-Host 'Nothing was changed.' -ForegroundColor Yellow
        exit 4
    }
}

$conflicts=@(); $todo=@(); $already=0
foreach($r in $rows){
    $fp=Fingerprint $r
    if($null -ne $state.stockImports.rows.PSObject.Properties[$fp]){$already++;continue}
    $matches=@($products | Where-Object { Product-IdentityMatch $_ $r })
    if($matches.Count -gt 0){
        $conflicts += [pscustomobject]@{ row=$r; matches=$matches; reason=$(if($matches.Count -gt 1){'multiple matching local products'}else{'matching local product already exists but was not created by this BAT'}) }
        continue
    }
    $todo += [pscustomobject]@{ row=$r; fp=$fp }
}
if($conflicts.Count -gt 0){
    Write-Host ''
    Write-Host 'SAFETY STOP: Possible duplicate product(s) found.' -ForegroundColor Yellow
    foreach($c in $conflicts | Select-Object -First 25){
        Write-Host ('  - ' + $c.row.brand + ' | ' + $c.row.size + ' | ' + $c.row.model + ' -> ' + $c.reason) -ForegroundColor White
    }
    Write-Host 'Nothing was changed. Send this message/screenshot before importing.' -ForegroundColor Yellow
    exit 5
}
if($todo.Count -eq 0){
    Write-Host ''
    Write-Host ('All ' + $rows.Count + ' rows were already imported by this BAT. No duplicate stock was added.') -ForegroundColor Green
    Start-Process ($Base + '?t=' + (Get-Date).ToString('yyyyMMddHHmmss'))
    exit 0
}

$counter=[int](Get-Prop $state.counters 'product' 0)
$low=2
try { $tmp=[double](Get-Prop (Get-Prop $state 'settings' $null) 'lowStockLevel' 2); if($tmp -ge 0){$low=[int]$tmp} } catch { }
$today=(Get-Date).ToString('yyyy-MM-dd'); $now=(Get-Date).ToString('o')
$newProducts=@($products)
foreach($item in $todo){
    $r=$item.row; $counter++
    $sku='SKU-' + $counter.ToString('0000')
    $p=[pscustomobject][ordered]@{
        id=('p-'+[Guid]::NewGuid().ToString('N')); code=$sku; qty=[double]$r.qty; unit='পিস'; lowStock=$low;
        vehicleType=''; barcode=''; photo=''; note=''; description=[string]$r.name; name=[string]$r.name;
        active=$true; createdAt=$now; purchases=@(); adjustments=@();
        brand=[string]$r.brand; size=[string]$r.size; model=[string]$r.model; type='টায়ার';
        sellPrice=0; pricePending=$true; buyPrice=0; buyPricePending=$true
    }
    $p.purchases=@([pscustomobject][ordered]@{date=$today;qty=[double]$r.qty;buyPrice=0;buyPricePending=$true;total=0;supplier='';note=('Imported from Product List - '+$BatchName)})
    $newProducts += $p
    $state.stockImports.rows | Add-Member -NotePropertyName $item.fp -NotePropertyValue $today -Force
}
$state.products=$newProducts
$state.counters.product=$counter
$state.stockImports.log=@($state.stockImports.log) + [pscustomobject][ordered]@{at=$now;file=[IO.Path]::GetFileName($CsvPath);batch=$BatchName;added=$todo.Count;restocked=0;skipped=$already}
$baseSeq=[int64](Get-Prop $state.meta 'saveSeq' 0)
$lineage=[string](Get-Prop $state.meta 'createdAt' '')
$state.meta.updatedAt=$now
$state.meta.saveSeq=$baseSeq+1
$json=$state | ConvertTo-Json -Depth 100 -Compress
$replyText=Http-PostState ($Base+'api/state') $json $baseSeq $lineage
$reply=$replyText | ConvertFrom-Json
if(-not $reply.saved){ throw ('Local save was not confirmed: ' + $replyText) }

Write-Host ''
Write-Host ('LOCAL SAVE COMPLETE: ' + $todo.Count + ' new products, ' + (($todo | ForEach-Object {$_.row.qty} | Measure-Object -Sum).Sum) + ' pcs stock added.') -ForegroundColor Green
if($already){Write-Host ('Skipped as already imported: ' + $already + ' row(s).') -ForegroundColor DarkGray}
Write-Host ('Saved through the Shoeb Motors local server. Online backup was not changed.') -ForegroundColor White
Write-Host 'Use the app Online Backup/Sync button later when you want this local data copied online.' -ForegroundColor DarkGray
Start-Process ($Base + '?t=' + (Get-Date).ToString('yyyyMMddHHmmss'))
exit 0
