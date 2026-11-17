import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = resolve(repoRoot, '.env');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const exe = env.GEDEMIN_WORKER_EXE || 'D:\\Soft\\gedemin-worker\\gedemin.exe';
const alias = env.GEDEMIN_WORKER_DB_ALIAS || 'WORKER_DB';
// /SN <alias> is broken when the alias already exists in databases.ini:
// ReadFromCmdLine treats it as a file path and creates an empty server entry.
// Prefer GEDEMIN_WORKER_SN; otherwise build from the same Firebird target as MCP.
const sn =
  env.GEDEMIN_WORKER_SN?.trim() ||
  (env.NODE_FB_HOST && env.NODE_FB_PORT && env.NODE_FB_DB
    ? `${env.NODE_FB_HOST}/${env.NODE_FB_PORT}:${env.NODE_FB_DB}`
    : '');
const user = env.GEDEMIN_WORKER_USER;
const password = env.GEDEMIN_WORKER_PASSWORD;
const port = env.GEDEMIN_WORKER_PORT || '9080';
const host = env.GEDEMIN_WORKER_HOST || '127.0.0.1';
if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
  console.error(
    `GEDEMIN_WORKER_HOST must be 127.0.0.1 (got "${host}") — refuse to start`
  );
  process.exit(1);
}

if (!existsSync(exe)) {
  console.error('gedemin.exe not found:', exe);
  process.exit(1);
}
if (!user) {
  console.error('GEDEMIN_WORKER_USER missing in .env');
  process.exit(1);
}
if (!sn) {
  console.error(
    'GEDEMIN_WORKER_SN missing, and NODE_FB_HOST/PORT/DB are not set to build one'
  );
  process.exit(1);
}

const args = [
  '/SN',
  sn,
  '/USER',
  user,
  '/PASSWORD',
  password,
  '/Q',
  '/NS',
];

console.log(`starting ${exe}`);
console.log(`args: /SN ${sn} /USER ${user} /PASSWORD *** /Q /NS (alias ${alias})`);
console.log(`expect web http://${host}:${port}/`);

async function probeWeb() {
  const res = await fetch(
    `http://${host}:${port}/test?user_name=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`
  );
  const text = await res.text();
  return { status: res.status, text };
}

try {
  const existing = await probeWeb();
  console.log(
    'web already up',
    existing.status,
    existing.text.slice(0, 200).replace(/\s+/g, ' ')
  );
  process.exit(0);
} catch {
  // port free — start a new worker
}

const child = spawn(exe, args, {
  cwd: dirname(exe),
  windowsHide: false,
  stdio: 'ignore',
  detached: true,
});
child.unref();
console.log('pid', child.pid);

const deadline = Date.now() + 90_000;
while (Date.now() < deadline) {
  try {
    const { status, text } = await probeWeb();
    console.log('web status', status, 'body', text.slice(0, 200).replace(/\s+/g, ' '));
    process.exit(0);
  } catch {
    await sleep(2000);
  }
}
console.error('web server did not respond within 90s');
process.exit(2);
