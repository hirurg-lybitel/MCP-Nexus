#Requires -Version 5.1
<#
.SYNOPSIS
  Operator helpers for MCP Nexus v2 on WORKING (native Node + Gedemin worker).

.DESCRIPTION
  Run on the WORKING host (not via remote automation).
  Repo expected at C:\Git\MCP-Nexus-v2 (or set -RepoRoot).
  FB5 client expected at C:\FB5 (prepended to PATH).

.EXAMPLE
  .\scripts\deploy-working.ps1 -Action check
  .\scripts\deploy-working.ps1 -Action create-startuser
  .\scripts\deploy-working.ps1 -Action create-user
  .\scripts\deploy-working.ps1 -Action mcp
  .\scripts\deploy-working.ps1 -Action worker
  .\scripts\deploy-working.ps1 -Action install-namespace
  .\scripts\deploy-working.ps1 -Action ready
#>
[CmdletBinding()]
param(
  [ValidateSet('check', 'create-startuser', 'create-user', 'mcp', 'worker', 'install-namespace', 'ready')]
  [string] $Action = 'check',

  [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,

  [string] $Fb5Path = 'C:\FB5'
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv {
  param([string] $Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    throw ".env not found: $Path"
  }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
      $map[$matches[1]] = $matches[2].Trim()
    }
  }
  return $map
}

function Assert-EnvKeys {
  param($EnvMap, [string[]] $Keys)
  $missing = @()
  foreach ($k in $Keys) {
    if (-not $EnvMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace([string]$EnvMap[$k])) {
      $missing += $k
    }
  }
  if ($missing.Count -gt 0) {
    throw "Missing/empty in .env: $($missing -join ', ')"
  }
}

function Use-Fb5Path {
  if (Test-Path -LiteralPath $Fb5Path) {
    $env:PATH = "$Fb5Path;$env:PATH"
    Write-Host "PATH += $Fb5Path"
  } else {
    Write-Warning "FB5 client not found at $Fb5Path — Firebird native driver may fail"
  }
}

Set-Location -LiteralPath $RepoRoot
$envPath = Join-Path $RepoRoot '.env'
$envMap = Read-DotEnv -Path $envPath
Use-Fb5Path

switch ($Action) {
  'check' {
    Assert-EnvKeys $envMap @(
      'NODE_FB_HOST', 'NODE_FB_PORT', 'NODE_FB_DB',
      'ISC_USER', 'ISC_PASSWORD', 'MCP_API_KEY',
      'GEDEMIN_WORKER_USER', 'GEDEMIN_WORKER_EXE', 'GEDEMIN_WORKER_SN'
    )
    $user = [string]$envMap['GEDEMIN_WORKER_USER']
    if ($user -eq 'Administrator' -and [string]::IsNullOrEmpty([string]$envMap['GEDEMIN_WORKER_PASSWORD'])) {
      Write-Warning 'GEDEMIN_WORKER_USER=Administrator with empty password — /Q will show login UI. Prefer mcp_worker.'
    }
    $hostBind = if ($envMap['MCP_HOST']) { $envMap['MCP_HOST'] } else { '127.0.0.1' }
    Write-Host "OK .env keys present"
    Write-Host "  FB: $($envMap['NODE_FB_HOST'])/$($envMap['NODE_FB_PORT']):$($envMap['NODE_FB_DB'])"
    Write-Host "  MCP_HOST=$hostBind MCP_PORT=$($envMap['MCP_PORT'])"
    Write-Host "  worker user=$user exe=$($envMap['GEDEMIN_WORKER_EXE'])"
    Write-Host "  SN=$($envMap['GEDEMIN_WORKER_SN'])"
    if ($hostBind -eq '127.0.0.1' -or $hostBind -eq 'localhost') {
      Write-Host "Note: MCP listens on loopback only. For LAN/WAN clients set MCP_HOST=0.0.0.0 and open TCP $($envMap['MCP_PORT'])."
    }
  }

  'create-startuser' {
    Assert-EnvKeys $envMap @('NODE_FB_HOST', 'NODE_FB_PORT', 'NODE_FB_DB', 'ISC_USER', 'ISC_PASSWORD')
    Write-Host 'Ensuring Firebird STARTUSER (both plugins) + GRANT ALTER ANY SEQUENCE...'
    node packages/db-firebird/scripts/ensure-startuser.mjs
  }

  'create-user' {
    Assert-EnvKeys $envMap @('NODE_FB_HOST', 'NODE_FB_PORT', 'NODE_FB_DB', 'ISC_USER', 'ISC_PASSWORD')
    Write-Host 'Creating/updating mcp_worker via create-worker-user-bg.mjs (run create-startuser first)...'
    node packages/db-firebird/scripts/create-worker-user-bg.mjs
  }

  'mcp' {
    Assert-EnvKeys $envMap @('NODE_FB_HOST', 'NODE_FB_PORT', 'NODE_FB_DB', 'ISC_USER', 'ISC_PASSWORD', 'MCP_API_KEY')
    Write-Host 'Starting mcp-server HTTP (blocking)...'
    pnpm --filter @mcp-nexus/mcp-server start:http
  }

  'worker' {
    Assert-EnvKeys $envMap @('GEDEMIN_WORKER_USER', 'GEDEMIN_WORKER_EXE', 'GEDEMIN_WORKER_SN')
    if (-not (Test-Path -LiteralPath ([string]$envMap['GEDEMIN_WORKER_EXE']))) {
      throw "GEDEMIN_WORKER_EXE not found: $($envMap['GEDEMIN_WORKER_EXE'])"
    }
    Write-Host 'Starting Gedemin worker (/Q /NS). Expect no login dialog. Blocking until :9080 ready or 90s timeout...'
    node packages/report-worker/scripts/start-worker.mjs
  }

  'install-namespace' {
    Write-Host 'Installing MCP worker namespace handlers...'
    node packages/report-worker/scripts/install-namespace.mjs
    Write-Host 'Restart the worker after install so RUNONLOGIN registers handlers.'
  }

  'ready' {
    $port = if ($envMap['MCP_PORT']) { $envMap['MCP_PORT'] } else { '4005' }
    $url = "http://127.0.0.1:$port/ready"
    Write-Host "GET $url"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 10
    $r | ConvertTo-Json -Depth 6
    if (-not $r.ok -or -not $r.firebird) {
      exit 2
    }
    if ($r.worker -and (-not $r.worker.reachable -or -not $r.worker.loginOk)) {
      Write-Warning 'MCP up but worker not ready (reachable/loginOk).'
      exit 3
    }
  }
}
