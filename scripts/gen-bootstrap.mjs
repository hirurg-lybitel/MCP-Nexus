import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptsDir, '..');
const files = {
  'scripts/deploy-working.ps1': readFileSync(
    join(root, 'scripts/deploy-working.ps1'),
    'utf8'
  ),
  'packages/db-firebird/scripts/ensure-startuser.mjs': readFileSync(
    join(root, 'packages/db-firebird/scripts/ensure-startuser.mjs'),
    'utf8'
  ),
};
const b64 = Buffer.from(JSON.stringify(files), 'utf8').toString('base64');
const out = `#Requires -Version 5.1
# Copy this file to C:\\Git\\MCP-Nexus-v2\\scripts\\ on WORKING, then:
#   powershell -ExecutionPolicy Bypass -File .\\scripts\\bootstrap-working-deploy.ps1
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$b64 = @'
${b64}
'@
$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64.Trim()))
$map = $json | ConvertFrom-Json
foreach ($p in $map.PSObject.Properties) {
  $path = Join-Path $RepoRoot $p.Name
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Set-Content -LiteralPath $path -Value $p.Value -Encoding UTF8
  Write-Host ("wrote " + $p.Name)
}
Write-Host 'Done. Next: .\\scripts\\deploy-working.ps1 -Action check'
`;
writeFileSync(join(scriptsDir, 'bootstrap-working-deploy.ps1'), out);
console.log('wrote bootstrap-working-deploy.ps1', out.length);
