import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_FB_HOST = 'localhost';

const tsx = resolve(repoRoot, 'apps/mcp-server/node_modules/tsx/dist/cli.mjs');
const entry = resolve(repoRoot, 'apps/mcp-server/src/index.ts');

const child = spawn(process.execPath, [tsx, entry, 'stdio'], {
  cwd: repoRoot,
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

let out = '';
let err = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  out += chunk;
  process.stderr.write(`OUT:${chunk}`);
});
child.stderr.on('data', (chunk) => {
  err += chunk;
  process.stderr.write(`ERR:${chunk}`);
});

function send(msg) {
  // MCP TypeScript SDK v2 stdio is newline-delimited JSON (not Content-Length)
  child.stdin.write(JSON.stringify(msg) + '\n');
}

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'smoke-stdio', version: '0' },
  },
});

const timer = setTimeout(() => {
  console.error('TIMEOUT outLen=', out.length, 'errLen=', err.length);
  child.kill();
  process.exit(1);
}, 20000);

function tryParse() {
  const line = out
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('{') && l.includes('"id"'));
  if (!line) return;
  clearTimeout(timer);
  const msg = JSON.parse(line);
  console.log(
    'OK',
    msg.result?.serverInfo?.name,
    'instructions=',
    Boolean(msg.result?.instructions)
  );
  child.kill();
  process.exit(msg.result?.serverInfo?.name === 'mcp-nexus' ? 0 : 2);
}

child.stdout.on('data', tryParse);
child.on('exit', (code, signal) => {
  console.error('child exit', code, signal);
});
