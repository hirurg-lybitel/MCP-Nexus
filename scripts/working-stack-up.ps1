#Requires -Version 5.1
<#
.SYNOPSIS
  Bring up MCP Nexus Docker stack on WORKING (mcp-server + web).
  Gedemin must already listen on 127.0.0.1:9080 on this host.
  Firebird is on the LAN (NODE_FB_* in .env).
#>
[CmdletBinding()]
param(
  [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

if (-not (Test-Path '.env')) {
  if (Test-Path '.env.stack.example') {
    Copy-Item '.env.stack.example' '.env'
    Write-Warning 'Created .env from .env.stack.example — fill MCP_API_KEY, ISC_*, GEDEMIN_WORKER_PASSWORD, then re-run.'
    exit 2
  }
  throw '.env missing'
}

# Force Docker→host Gedemin even if .env still has 127.0.0.1
$env:GEDEMIN_WORKER_URL = 'http://host.docker.internal:9080'

# Containers cannot use Windows localhost for Firebird. For local BG (.env localhost)
# write a temp env overlay; for WORKING LAN IPs keep .env as-is.
$composeEnv = Join-Path $RepoRoot '.env'
$fbHost = $null
Get-Content $composeEnv | ForEach-Object {
  if ($_ -match '^\s*NODE_FB_HOST\s*=\s*(.+)\s*$') { $fbHost = $matches[1].Trim() }
}
$tempEnv = $null
if ($fbHost -eq 'localhost' -or $fbHost -eq '127.0.0.1') {
  $tempEnv = Join-Path $env:TEMP ('mcp-nexus-stack-' + [guid]::NewGuid().ToString('n') + '.env')
  (Get-Content $composeEnv) | ForEach-Object {
    if ($_ -match '^\s*NODE_FB_HOST\s*=') { 'NODE_FB_HOST=host.docker.internal' } else { $_ }
  } | Set-Content -LiteralPath $tempEnv -Encoding UTF8
  $composeEnv = $tempEnv
  Write-Host "Using temp env with NODE_FB_HOST=host.docker.internal (was $fbHost)"
} else {
  Write-Host "NODE_FB_HOST=$fbHost (passed to containers as-is)"
}

Write-Host 'Building/starting stack (mcp-server :4005, web :4004)...'
try {
  docker compose -f docker-compose.stack.yaml --env-file $composeEnv up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
} finally {
  if ($tempEnv -and (Test-Path $tempEnv)) { Remove-Item $tempEnv -Force }
}

Start-Sleep -Seconds 5
Write-Host 'GET http://127.0.0.1:4005/ready'
$ready = Invoke-RestMethod 'http://127.0.0.1:4005/ready' -TimeoutSec 30
$ready | ConvertTo-Json -Depth 6

if (-not $ready.ok -or -not $ready.firebird) {
  throw 'MCP /ready failed (ok/firebird)'
}
if (-not $ready.worker.reachable -or -not $ready.worker.loginOk) {
  Write-Warning 'MCP up, but Gedemin worker not ready. Start gedemin on host :9080 (empty Admin UI is wrong — use mcp_worker + /Q).'
  exit 3
}

Write-Host 'Stack OK. UI http://127.0.0.1:4004  MCP http://127.0.0.1:4005/mcp'
