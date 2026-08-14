$ErrorActionPreference = 'Continue'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$pidFiles = @(
  'api-sidecar.pid',
  'web-sidecar.pid',
  'worker-sidecar.pid'
)

foreach ($pidFile in $pidFiles) {
  $path = Join-Path $workspaceRoot $pidFile
  if (-not (Test-Path $path)) {
    continue
  }

  $processId = Get-Content $path -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($processId) {
    Stop-Process -Id ([int]$processId) -ErrorAction SilentlyContinue
    Write-Output "STOPPED $pidFile process $processId"
  }
}
