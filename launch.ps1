param(
  [Parameter(Mandatory=$true)][ValidateSet('codex','zcode')][string]$App,
  [ValidateSet('Launch','Check','Restore')][string]$Action='Launch',
  [string]$AppPath
)
$ErrorActionPreference='Stop'
$state=Join-Path $env:LOCALAPPDATA 'AgentTerminalClarity'
$node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source
if(-not $node){throw 'Node.js 22+ is required. Install Node.js LTS, then run this launcher again.'}
$nodeVersion=(& $node --version | Select-Object -Last 1)
if($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') {throw 'Cannot determine the Node.js version.'}
if([int]$Matches[1] -lt 22){throw 'Node.js 22+ is required.'}
$runtime=Join-Path $PSScriptRoot 'runtime.mjs'
if($Action -eq 'Check'){& $node $runtime --app $App --check;exit $LASTEXITCODE}
if($Action -eq 'Restore'){
  & $node $runtime --app $App --stop
  & $node $runtime --app $App --restore
  if($LASTEXITCODE -ne 0){Write-Warning 'If the app is closed, no runtime CSS remains. Otherwise fully exit it to restore.'}
  exit
}
if(-not $AppPath){
  if($App -eq 'codex'){
    $pkg=Get-AppxPackage -Name OpenAI.Codex | Sort-Object {[version]$_.Version} -Descending | Select-Object -First 1
    if($pkg){$AppPath=Join-Path $pkg.InstallLocation 'app\ChatGPT.exe'}
    if(-not $AppPath){$AppPath=Join-Path $env:LOCALAPPDATA 'Programs\Codex\Codex.exe'}
  }else{$AppPath=Join-Path $env:LOCALAPPDATA 'Programs\ZCode\ZCode.exe'}
}
if(-not(Test-Path -LiteralPath $AppPath -PathType Leaf)){throw 'Application not found. Supply -AppPath with its executable path.'}
$AppPath=(Resolve-Path -LiteralPath $AppPath).Path
$running=Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $AppPath}
if($running){throw "Please save work and fully exit $App first. This launcher never closes a running application."}
$port=if($App -eq 'codex'){29471}else{29472}
if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw "Port $port is already occupied. Nothing was started."}
if(Test-Path -LiteralPath (Join-Path $state "$App.lock")){throw 'Watcher lock exists. Inspect it or use RESTORE before starting another watcher.'}
New-Item -ItemType Directory -Path $state -Force | Out-Null
Start-Process -FilePath $AppPath -ArgumentList @('--remote-debugging-address=127.0.0.1',"--remote-debugging-port=$port") -WindowStyle Hidden | Out-Null
$ready=$false
for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 500
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
  if($listeners){
    if(@($listeners | Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}).Count){throw 'Debug port is not loopback-only. Fully exit the app before continuing.'}
    $owner=Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -in $listeners.OwningProcess}
    if(@($owner | Where-Object {$_.ExecutablePath -ne $AppPath}).Count){throw 'Debug port belongs to a different application. No CSS injected.'}
    $ready=$true;break
  }
}
if(-not $ready){throw 'Debug endpoint did not start. No CSS was injected. The app was left running.'}
$stdout=Join-Path $state "$App.log"
$stderr=Join-Path $state "$App-errors.log"
Start-Process -FilePath $node -ArgumentList @(('"'+$runtime+'"'),'--app',$App,'--watch') -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr | Out-Null
Write-Host "Theme watcher started for $App on loopback port $port. Open an existing reply to see semantic colors. Logs: $state"
