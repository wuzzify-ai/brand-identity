$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$runtimeNode = 'C:\Users\Ahmed Mohamed\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$runtimeBin = 'C:\Users\Ahmed Mohamed\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback'
$env:Path = "$runtimeNode;$runtimeBin;$env:Path"

$env:DATABASE_URL = 'postgres://brand_identity:brand_identity_dev@127.0.0.1:55434/brand_identity_v3'
$env:REDIS_URL = 'redis://127.0.0.1:56379'
$env:API_PORT = '4100'
$env:API_PUBLIC_URL = 'http://localhost:4100/v1'
$env:WEB_ORIGIN = 'http://localhost:3100'
$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4100/v1'
$env:NEXT_PUBLIC_APP_URL = 'http://localhost:3100'

Set-Location $workspaceRoot

pnpm --filter '@wuzzify/brand-identity-worker' build

$pnpm = (Get-Command pnpm.cmd).Source
$node = (Get-Command node.exe).Source

$api = Start-Process `
  -FilePath $pnpm `
  -ArgumentList @('--filter', '@wuzzify/brand-identity-api', 'start:dev') `
  -WorkingDirectory $workspaceRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $workspaceRoot 'api-sidecar.out.log') `
  -RedirectStandardError (Join-Path $workspaceRoot 'api-sidecar.err.log') `
  -PassThru

$web = Start-Process `
  -FilePath $pnpm `
  -ArgumentList @('--dir', 'apps/web', 'exec', 'next', 'dev', '--port', '3100') `
  -WorkingDirectory $workspaceRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $workspaceRoot 'web-sidecar.out.log') `
  -RedirectStandardError (Join-Path $workspaceRoot 'web-sidecar.err.log') `
  -PassThru

$worker = Start-Process `
  -FilePath $node `
  -ArgumentList @('dist/main.js') `
  -WorkingDirectory (Join-Path $workspaceRoot 'apps/worker') `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $workspaceRoot 'worker-sidecar.out.log') `
  -RedirectStandardError (Join-Path $workspaceRoot 'worker-sidecar.err.log') `
  -PassThru

$api.Id | Set-Content (Join-Path $workspaceRoot 'api-sidecar.pid')
$web.Id | Set-Content (Join-Path $workspaceRoot 'web-sidecar.pid')
$worker.Id | Set-Content (Join-Path $workspaceRoot 'worker-sidecar.pid')

Write-Output "STARTED api=$($api.Id) web=$($web.Id) worker=$($worker.Id)"

$deadline = (Get-Date).AddSeconds(90)
do {
  $apiLive = $false
  $apiReady = $false
  $webReady = $false

  try {
    $live = Invoke-RestMethod -Uri 'http://localhost:4100/v1/health/live' -TimeoutSec 2
    $apiLive = $live.status -eq 'ok'
  } catch {}

  try {
    $ready = Invoke-RestMethod -Uri 'http://localhost:4100/v1/health/ready' -TimeoutSec 2
    $apiReady = $ready.status -eq 'ok'
  } catch {}

  try {
    $webResponse = Invoke-WebRequest -Uri 'http://localhost:3100' -TimeoutSec 2 -UseBasicParsing
    $webReady = [int]$webResponse.StatusCode -lt 500
  } catch {}

  if ($apiLive -and $apiReady -and $webReady) {
    Write-Output "DEV_READY apiLive=$apiLive apiReady=$apiReady web=$webReady"
    exit 0
  }

  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

Write-Output 'DEV_NOT_READY'
Write-Output 'api.out tail:'
Get-Content (Join-Path $workspaceRoot 'api-sidecar.out.log') -Tail 40 -ErrorAction SilentlyContinue
Write-Output 'api.err tail:'
Get-Content (Join-Path $workspaceRoot 'api-sidecar.err.log') -Tail 80 -ErrorAction SilentlyContinue
Write-Output 'web.out tail:'
Get-Content (Join-Path $workspaceRoot 'web-sidecar.out.log') -Tail 40 -ErrorAction SilentlyContinue
Write-Output 'web.err tail:'
Get-Content (Join-Path $workspaceRoot 'web-sidecar.err.log') -Tail 80 -ErrorAction SilentlyContinue
Write-Output 'worker.out tail:'
Get-Content (Join-Path $workspaceRoot 'worker-sidecar.out.log') -Tail 40 -ErrorAction SilentlyContinue
Write-Output 'worker.err tail:'
Get-Content (Join-Path $workspaceRoot 'worker-sidecar.err.log') -Tail 80 -ErrorAction SilentlyContinue
exit 1
