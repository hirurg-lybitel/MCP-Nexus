#Requires -Version 5.1
<#
.SYNOPSIS
  One-shot bootstrap for MCP Nexus v2 on a remote Windows host.

.DESCRIPTION
  Checks prerequisites, installs what it can (Git / Node / Docker Desktop via winget),
  pulls the repo, prepares .env, ensures Firebird STARTUSER + mcp_worker (when Node deps work),
  starts Gedemin worker on :9080, builds and starts Docker stack (mcp-server + web),
  verifies /ready.

  Architecture this script targets:
    - mcp-server + web  → Docker containers on this Windows host
    - Firebird          → another LAN host (NODE_FB_* in .env)
    - Gedemin           → same Windows host as Docker (:9080)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-remote-stack.ps1

.EXAMPLE
  # Repo already cloned — skip git pull; Docker Desktop will be installed/started if missing
  powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-remote-stack.ps1 -SkipGitPull

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-remote-stack.ps1 -NonInteractive -SkipWingetInstall
#>
[CmdletBinding()]
param(
  [string] $RepoRoot = 'C:\Git\MCP-Nexus-v2',
  [string] $GitUrl = 'https://github.com/hirurg-lybitel/MCP-Nexus.git',
  [string] $Branch = 'feature/mcp-v2',
  [string] $Fb5Path = 'C:\FB5',
  [switch] $NonInteractive,
  [switch] $SkipWingetInstall,
  [switch] $SkipPnpmInstall,
  [switch] $SkipFbUsers,
  [switch] $SkipNamespace,
  [switch] $SkipWorker,
  [switch] $SkipDockerBuild,
  [switch] $SkipGitPull,
  [switch] $OpenFirewall
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step([string] $Message) {
  Write-Host ""
  Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Write-Ok([string] $Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn2([string] $Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail([string] $Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red }

function Test-CommandExists([string] $Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Dir([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Read-DotEnv([string] $Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
      $map[$matches[1]] = $matches[2].Trim()
    }
  }
  return $map
}

function Test-EnvComplete($EnvMap, [string[]] $Keys) {
  $bad = @()
  foreach ($k in $Keys) {
    if (-not $EnvMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace([string]$EnvMap[$k])) {
      $bad += $k
      continue
    }
    $v = [string]$EnvMap[$k]
    if ($v -match 'replace-with|replace-me|^sk-\.\.\.$') { $bad += "$k(placeholder)" }
  }
  return $bad
}

function Test-TcpPort([string] $HostName, [int] $Port, [int] $TimeoutMs = 4000) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) { $client.Close(); return $false }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Invoke-WingetInstall([string] $Id, [string] $Label) {
  if ($SkipWingetInstall) {
    Write-Warn2 "SkipWingetInstall: not installing $Label"
    return $false
  }
  if (-not (Test-CommandExists 'winget')) {
    Write-Warn2 "winget not found — install $Label manually"
    return $false
  }
  Write-Host "Installing $Label via winget ($Id)..."
  & winget install --id $Id -e --accept-package-agreements --accept-source-agreements
  return ($LASTEXITCODE -eq 0)
}

function Refresh-PathFromMachine {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:PATH = "$machine;$user"
  if (Test-Path -LiteralPath $Fb5Path) {
    $env:PATH = "$Fb5Path;$env:PATH"
  }
}

function Get-DockerDesktopExe {
  $candidates = @(
    (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path $env:LOCALAPPDATA 'Docker\Docker Desktop.exe')
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  return $null
}

function Test-DockerEngine {
  if (-not (Test-CommandExists 'docker')) { return $false }
  try {
    $null = & docker info 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Wait-DockerReady([int] $Seconds = 300) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  $n = 0
  while ((Get-Date) -lt $deadline) {
    Refresh-PathFromMachine
    if (Test-DockerEngine) { return $true }
    $n++
    Write-Host "  waiting for Docker engine... ($n)"
    Start-Sleep -Seconds 5
  }
  return $false
}

function Test-WslAvailable {
  if (-not (Test-CommandExists 'wsl')) { return $false }
  try {
    & wsl --status 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Ensure-DockerDesktop {
  Write-Step "3/10 Prerequisites: Docker Desktop"

  if (Test-DockerEngine) {
    $ver = (& docker version --format '{{.Server.Version}}' 2>$null)
    Write-Ok "Docker engine already running (server $ver)"
    & docker compose version
    if ($LASTEXITCODE -ne 0) {
      throw 'docker compose plugin missing — update Docker Desktop'
    }
    $osType = (& docker info --format '{{.OSType}}' 2>$null)
    if ($osType -and $osType -ne 'linux') {
      Write-Warn2 "Docker OSType=$osType — MCP images need Linux containers. Switch Docker Desktop to Linux containers and re-run."
      throw 'Linux containers required'
    }
    Write-Ok 'Linux containers OK'
    return
  }

  $ddExe = Get-DockerDesktopExe
  $hasCli = Test-CommandExists 'docker'

  if (-not $ddExe -and -not $hasCli) {
    Write-Warn2 'Docker Desktop not found on this Windows host'
    if (-not (Test-WslAvailable)) {
      Write-Warn2 'WSL not detected. Docker Desktop usually needs WSL2. Enabling optional features if possible...'
      if (-not $SkipWingetInstall) {
        try {
          # Best-effort; may require reboot / admin
          & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart 2>$null | Out-Null
          & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart 2>$null | Out-Null
          Write-Warn2 'WSL/VMP features requested. If install fails, reboot and run: wsl --install'
        } catch {
          Write-Warn2 "Could not enable WSL features: $($_.Exception.Message)"
        }
      }
    }

    $installed = Invoke-WingetInstall 'Docker.DockerDesktop' 'Docker Desktop'
    if (-not $installed) {
      Write-Fail @'
Docker Desktop is required and was not installed automatically.

Install manually:
  1) https://docs.docker.com/desktop/setup/install/windows-install/
  2) Enable WSL2 backend (recommended)
  3) Start Docker Desktop, wait until status is Running
  4) Ensure "Use the WSL 2 based engine" / Linux containers
  5) Re-run this script

Or: winget install --id Docker.DockerDesktop -e
'@
      throw 'Docker Desktop missing'
    }

    Refresh-PathFromMachine
    $ddExe = Get-DockerDesktopExe
    Write-Ok 'Docker Desktop package installed (first start may take several minutes)'
  } else {
    Write-Ok "Docker Desktop present: $ddExe"
  }

  # Start Docker Desktop if engine is down
  if (-not (Test-DockerEngine)) {
    if (-not $ddExe) { $ddExe = Get-DockerDesktopExe }
    if ($ddExe) {
      $running = Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue
      if (-not $running) {
        Write-Host "Starting Docker Desktop: $ddExe"
        Start-Process -FilePath $ddExe
      } else {
        Write-Host 'Docker Desktop process is running — waiting for engine...'
      }
    } else {
      Write-Warn2 'Docker Desktop.exe not found after install — start it from Start Menu'
      if (-not $NonInteractive) {
        Write-Host 'Press Enter after Docker Desktop shows Running...'
        [void](Read-Host)
      }
    }

    if (-not (Wait-DockerReady 420)) {
      Write-Fail 'Docker engine did not become ready in time'
      Write-Host 'Open Docker Desktop → Troubleshoot / restart. Need Linux containers + WSL2.'
      throw 'Docker engine not ready'
    }
  }

  Refresh-PathFromMachine
  if (-not (Test-CommandExists 'docker')) {
    throw 'docker CLI still not on PATH. Sign out/in or reboot after Docker Desktop install, then re-run.'
  }

  & docker compose version
  if ($LASTEXITCODE -ne 0) {
    throw 'docker compose not available'
  }

  $osType = (& docker info --format '{{.OSType}}' 2>$null)
  Write-Host "Docker OSType=$osType"
  if ($osType -and $osType -ne 'linux') {
    throw 'Switch Docker Desktop to Linux containers, then re-run this script'
  }

  $ver = (& docker version --format '{{.Server.Version}}' 2>$null)
  Write-Ok "Docker engine ready (server $ver)"
}

function Ensure-FirewallRules {
  if (-not $OpenFirewall) { return }
  Write-Step "Firewall rules (4004, 4005)"
  foreach ($rule in @(
      @{ Name = 'MCP-Nexus-UI-4004'; Port = 4004 },
      @{ Name = 'MCP-Nexus-MCP-4005'; Port = 4005 }
    )) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if (-not $existing) {
      New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $rule.Port | Out-Null
      Write-Ok "Opened TCP $($rule.Port) ($($rule.Name))"
    } else {
      Write-Ok "Firewall rule already exists: $($rule.Name)"
    }
  }
}

# ---------------------------------------------------------------------------
Write-Step "MCP Nexus remote bootstrap"
Write-Host "RepoRoot=$RepoRoot  Branch=$Branch"

# ---------------------------------------------------------------------------
Write-Step "1/10 Prerequisites: Git"
if (-not (Test-CommandExists 'git')) {
  if (-not (Invoke-WingetInstall 'Git.Git' 'Git')) {
    throw 'Git is required. Install Git for Windows and re-run.'
  }
  Refresh-PathFromMachine
}
if (-not (Test-CommandExists 'git')) { throw 'Git still not on PATH after install. Open a new PowerShell and re-run.' }
Write-Ok "git $(git --version)"

# ---------------------------------------------------------------------------
Write-Step "2/10 Prerequisites: Node.js (for Gedemin worker scripts)"
if (-not (Test-CommandExists 'node')) {
  if (-not (Invoke-WingetInstall 'OpenJS.NodeJS.LTS' 'Node.js LTS')) {
    throw 'Node.js is required for start-worker / ensure-startuser. Install Node LTS and re-run.'
  }
  Refresh-PathFromMachine
}
if (-not (Test-CommandExists 'node')) { throw 'Node still not on PATH. Open a new PowerShell and re-run.' }
Write-Ok "node $(node -v)"

if (-not (Test-CommandExists 'corepack')) {
  Write-Warn2 'corepack not found — will try npm i -g pnpm later if needed'
} else {
  try {
    corepack enable 2>$null
    corepack prepare pnpm@10.28.1 --activate 2>$null
  } catch {
    Write-Warn2 "corepack prepare failed: $($_.Exception.Message)"
  }
}
if (-not (Test-CommandExists 'pnpm')) {
  Write-Host 'Installing pnpm globally via npm...'
  npm install -g pnpm@10.28.1
  Refresh-PathFromMachine
}
if (Test-CommandExists 'pnpm') {
  Write-Ok "pnpm $(pnpm -v)"
} else {
  Write-Warn2 'pnpm unavailable — SkipPnpmInstall / SkipFbUsers may be required'
}

# ---------------------------------------------------------------------------
Ensure-DockerDesktop

# ---------------------------------------------------------------------------
Write-Step "4/10 Repository"
Ensure-Dir (Split-Path -Parent $RepoRoot)
$gitDir = Join-Path $RepoRoot '.git'
$composeFile = Join-Path $RepoRoot 'docker-compose.stack.yaml'

if (-not (Test-Path -LiteralPath $RepoRoot)) {
  Write-Host "Cloning $GitUrl → $RepoRoot (branch $Branch)..."
  git clone --branch $Branch --single-branch $GitUrl $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
} elseif (-not (Test-Path -LiteralPath $gitDir)) {
  Write-Warn2 "Directory exists but is not a git checkout: $RepoRoot — using files as-is"
} elseif ($SkipGitPull) {
  Write-Ok "SkipGitPull: using existing repo at $RepoRoot"
} else {
  Write-Host "Repo already present — fetch/checkout/pull $Branch..."
  Push-Location $RepoRoot
  try {
    git fetch origin
    git checkout $Branch
    git pull --ff-only origin $Branch
    if ($LASTEXITCODE -ne 0) {
      Write-Warn2 'git pull --ff-only failed — continuing with current tree'
    } else {
      Write-Ok "Updated to origin/$Branch"
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $composeFile)) {
  throw "docker-compose.stack.yaml missing in $RepoRoot — incomplete tree or wrong folder"
}
Write-Ok "Repo ready: $RepoRoot"
Set-Location -LiteralPath $RepoRoot

# ---------------------------------------------------------------------------
Write-Step "5/10 Environment (.env)"
$envPath = Join-Path $RepoRoot '.env'
$examplePath = Join-Path $RepoRoot '.env.stack.example'
if (-not (Test-Path -LiteralPath $envPath)) {
  if (-not (Test-Path -LiteralPath $examplePath)) {
    throw '.env and .env.stack.example both missing'
  }
  Copy-Item $examplePath $envPath
  Write-Warn2 "Created .env from .env.stack.example — fill secrets"
}

# Force Docker→host Gedemin URL
$raw = Get-Content $envPath -Raw
if ($raw -notmatch '(?m)^GEDEMIN_WORKER_URL=') {
  $raw = $raw.TrimEnd() + "`r`nGEDEMIN_WORKER_URL=http://host.docker.internal:9080`r`n"
} else {
  $raw = [regex]::Replace($raw, '(?m)^GEDEMIN_WORKER_URL=.*$', 'GEDEMIN_WORKER_URL=http://host.docker.internal:9080')
}
if ($raw -notmatch '(?m)^MCP_UPSTREAM_URL=') {
  $raw = $raw.TrimEnd() + "`r`nMCP_UPSTREAM_URL=http://mcp-server:4005/mcp`r`n"
}
if ($raw -notmatch '(?m)^WEB_EMBEDDED_MCP=') {
  $raw = $raw.TrimEnd() + "`r`nWEB_EMBEDDED_MCP=0`r`n"
}
if ($raw -notmatch '(?m)^MCP_HOST=') {
  $raw = $raw.TrimEnd() + "`r`nMCP_HOST=0.0.0.0`r`n"
}
Set-Content -LiteralPath $envPath -Value $raw -Encoding UTF8

$envMap = Read-DotEnv $envPath
$required = @(
  'MCP_API_KEY',
  'NODE_FB_HOST', 'NODE_FB_PORT', 'NODE_FB_DB',
  'ISC_USER', 'ISC_PASSWORD',
  'GEDEMIN_WORKER_USER', 'GEDEMIN_WORKER_PASSWORD', 'GEDEMIN_WORKER_EXE', 'GEDEMIN_WORKER_SN'
)
$missing = Test-EnvComplete $envMap $required
if ($missing.Count -gt 0) {
  Write-Fail ("Incomplete .env: " + ($missing -join ', '))
  if ($NonInteractive) {
    throw 'Fix .env and re-run with secrets filled (no placeholders).'
  }
  Write-Host 'Opening .env in notepad — save and close when done...'
  Start-Process -FilePath 'notepad.exe' -ArgumentList $envPath -Wait
  $envMap = Read-DotEnv $envPath
  $missing = Test-EnvComplete $envMap $required
  if ($missing.Count -gt 0) {
    throw ("Still incomplete .env: " + ($missing -join ', '))
  }
}

$fbHost = [string]$envMap['NODE_FB_HOST']
if ($fbHost -eq 'localhost' -or $fbHost -eq '127.0.0.1') {
  Write-Warn2 "NODE_FB_HOST=$fbHost — for remote LAN deploy use the Firebird server IP (e.g. 192.168.0.62), not localhost"
}
if (-not $envMap.ContainsKey('OPENAI_API_KEY') -or [string]::IsNullOrWhiteSpace([string]$envMap['OPENAI_API_KEY'])) {
  Write-Warn2 'OPENAI_API_KEY empty — chat UI will return "OpenAI not configured" until you set it and recreate web'
}
Write-Ok '.env looks usable'

# ---------------------------------------------------------------------------
Write-Step "6/10 Connectivity: Firebird LAN + local ports"
$fbPort = [int]$envMap['NODE_FB_PORT']
if (Test-TcpPort $fbHost $fbPort) {
  Write-Ok "TCP ${fbHost}:${fbPort} reachable"
} else {
  Write-Fail "Cannot reach Firebird at ${fbHost}:${fbPort} from this host"
  if ($NonInteractive) {
    throw 'Fix LAN/firewall/Firebird listen address and re-run.'
  }
  Write-Warn2 'Continuing anyway — Docker build may still work; /ready firebird will fail'
}

if (Test-Path -LiteralPath $Fb5Path) {
  $env:PATH = "$Fb5Path;$env:PATH"
  Write-Ok "FB5 client path on PATH: $Fb5Path"
} else {
  Write-Warn2 "FB5 client not found at $Fb5Path — Gedemin /Q may fail without fbclient on host"
}

$gedExe = [string]$envMap['GEDEMIN_WORKER_EXE']
if (Test-Path -LiteralPath $gedExe) {
  Write-Ok "Gedemin exe found: $gedExe"
} else {
  throw "GEDEMIN_WORKER_EXE not found: $gedExe — install Gedemin or fix path in .env"
}

# ---------------------------------------------------------------------------
Write-Step "7/10 pnpm install (host scripts for FB users / worker)"
if (-not $SkipPnpmInstall) {
  if (-not (Test-CommandExists 'pnpm')) {
    Write-Warn2 'pnpm missing — skipping host install'
  } else {
    Write-Host 'pnpm install --frozen-lockfile (may take several minutes)...'
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
      Write-Warn2 'pnpm install --frozen-lockfile failed — trying without frozen lockfile'
      pnpm install
    }
    if ($LASTEXITCODE -ne 0) {
      Write-Warn2 'pnpm install failed — SkipFbUsers / worker scripts may not run'
    } else {
      Write-Ok 'pnpm install done'
      try {
        pnpm --filter @mcp-nexus/db-firebird build
      } catch {
        Write-Warn2 "db-firebird build: $($_.Exception.Message)"
      }
    }
  }
} else {
  Write-Warn2 'SkipPnpmInstall set'
}

# ---------------------------------------------------------------------------
Write-Step "8/10 Firebird STARTUSER + mcp_worker + namespace"
if (-not $SkipFbUsers) {
  if (Test-Path -LiteralPath (Join-Path $RepoRoot 'packages\db-firebird\scripts\ensure-startuser.mjs')) {
    try {
      Write-Host 'ensure-startuser...'
      node packages\db-firebird\scripts\ensure-startuser.mjs
      Write-Ok 'ensure-startuser finished'
    } catch {
      Write-Warn2 "ensure-startuser failed: $($_.Exception.Message)"
    }
    try {
      Write-Host 'create-worker-user...'
      node packages\db-firebird\scripts\create-worker-user-bg.mjs
      Write-Ok 'create-worker-user finished'
    } catch {
      Write-Warn2 "create-worker-user failed: $($_.Exception.Message)"
    }
  } else {
    Write-Warn2 'ensure-startuser.mjs not found'
  }
} else {
  Write-Warn2 'SkipFbUsers set'
}

if (-not $SkipNamespace) {
  try {
    Write-Host 'install-namespace...'
    node packages\report-worker\scripts\install-namespace.mjs
    Write-Ok 'install-namespace finished (restart worker after this)'
  } catch {
    Write-Warn2 "install-namespace failed: $($_.Exception.Message)"
  }
}

# ---------------------------------------------------------------------------
Write-Step "9/10 Gedemin worker on :9080"
if (-not $SkipWorker) {
  $already = Test-TcpPort '127.0.0.1' 9080 1500
  if ($already) {
    try {
      $probe = Invoke-RestMethod 'http://127.0.0.1:9080/test' -TimeoutSec 10
      Write-Ok "Gedemin already responding on :9080 ($probe)"
    } catch {
      Write-Warn2 'Port 9080 open but /test failed — check Gedemin UI login dialog'
    }
  } else {
    Write-Host 'Starting Gedemin worker in background (start-worker.mjs)...'
    $workerLog = Join-Path $RepoRoot 'logs\gedemin-worker-bootstrap.log'
    Ensure-Dir (Split-Path $workerLog -Parent)
    $nodeExe = (Get-Command node).Source
    Start-Process -FilePath $nodeExe `
      -ArgumentList @(
        (Join-Path $RepoRoot 'packages\report-worker\scripts\start-worker.mjs')
      ) `
      -WorkingDirectory $RepoRoot `
      -WindowStyle Minimized `
      -RedirectStandardOutput $workerLog `
      -RedirectStandardError $workerLog `
      -PassThru | Out-Null

    $readyWorker = $false
    for ($i = 0; $i -lt 36; $i++) {
      Start-Sleep -Seconds 5
      try {
        Invoke-RestMethod 'http://127.0.0.1:9080/test' -TimeoutSec 5 | Out-Null
        $readyWorker = $true
        break
      } catch {
        Write-Host "  waiting for :9080 ($i/36)..."
      }
    }
    if ($readyWorker) {
      Write-Ok 'Gedemin /test OK'
    } else {
      Write-Fail "Gedemin did not become ready in time. See $workerLog"
      Write-Warn2 'Empty Admin login UI breaks /Q — use mcp_worker + STARTUSER'
      if ($NonInteractive) {
        throw 'Worker not ready'
      }
    }
  }
} else {
  Write-Warn2 'SkipWorker set'
}

# ---------------------------------------------------------------------------
Write-Step "10/10 Docker stack (mcp-server + web)"
Ensure-FirewallRules

$env:GEDEMIN_WORKER_URL = 'http://host.docker.internal:9080'
if ($SkipDockerBuild) {
  Write-Host 'docker compose up -d (no --build)...'
  docker compose -f docker-compose.stack.yaml --env-file .env up -d
} else {
  Write-Host 'docker compose up -d --build (first build can take 10–20+ minutes)...'
  docker compose -f docker-compose.stack.yaml --env-file .env up -d --build
}
if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }

Start-Sleep -Seconds 8
Write-Host 'GET http://127.0.0.1:4005/ready'
try {
  $ready = Invoke-RestMethod 'http://127.0.0.1:4005/ready' -TimeoutSec 60
  $ready | ConvertTo-Json -Depth 6
} catch {
  throw "MCP /ready request failed: $($_.Exception.Message)"
}

$webCode = 0
try {
  $web = Invoke-WebRequest 'http://127.0.0.1:4004/api/health-check' -UseBasicParsing -TimeoutSec 30
  $webCode = [int]$web.StatusCode
  Write-Ok "web /api/health-check → $webCode"
} catch {
  Write-Warn2 "web health-check failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Step "Summary"
if ($ready.ok -and $ready.firebird) {
  Write-Ok "MCP firebird=true"
} else {
  Write-Fail 'MCP /ready: ok/firebird not green'
}
if ($ready.worker -and $ready.worker.reachable -and $ready.worker.loginOk) {
  Write-Ok 'Worker reachable + loginOk'
} else {
  Write-Warn2 "Worker not fully ready: $($ready.worker | ConvertTo-Json -Compress)"
}

Write-Host ""
Write-Host "UI:  http://127.0.0.1:4004" -ForegroundColor Green
Write-Host "MCP: http://127.0.0.1:4005/mcp  (Authorization: Bearer <MCP_API_KEY>)" -ForegroundColor Green
Write-Host "Ready: http://127.0.0.1:4005/ready"
Write-Host ""
Write-Host 'In UI Settings: paste MCP_API_KEY and OpenAI token, then Verify.'
Write-Host 'Full guide: docs\deploy-remote-docker-stack.md'

if (-not ($ready.ok -and $ready.firebird)) { exit 2 }
if (-not ($ready.worker.reachable -and $ready.worker.loginOk)) { exit 3 }
exit 0
