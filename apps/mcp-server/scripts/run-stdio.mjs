/**
 * Stdio entry for Cursor MCP.
 * Avoids `pnpm`/`npx` stdout noise that breaks the JSON-RPC stream.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '../..');
const entry = resolve(appRoot, 'src/index.ts');

process.chdir(repoRoot);
process.env.NODE_FB_HOST ||= 'localhost';

const require = createRequire(resolve(appRoot, 'package.json'));
const tsxCli = require.resolve('tsx/cli');

const child = spawn(process.execPath, [tsxCli, entry, 'stdio'], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
