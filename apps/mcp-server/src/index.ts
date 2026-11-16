import './load-env.js';
import { setAuditTransport } from './lib/audit.js';
import { startHttpServer } from './http.js';
import { startStdioServer } from './stdio.js';
import {
  assertStartupEnv,
  logWorkerStartupCheck,
  StartupError,
  type StartupMode,
} from './startup.js';

async function main(): Promise<void> {
  const modeArg = (process.argv[2] ?? 'http').toLowerCase();
  if (modeArg !== 'http' && modeArg !== 'stdio') {
    console.error(`Unknown mode "${modeArg}". Use: http | stdio`);
    process.exit(1);
  }
  const mode = modeArg as StartupMode;
  setAuditTransport(mode);

  try {
    assertStartupEnv(mode);
  } catch (error) {
    const message =
      error instanceof StartupError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`[startup] ${message}`);
    process.exit(1);
  }

  await logWorkerStartupCheck();

  const port = Number.parseInt(process.env.MCP_PORT ?? '4005', 10);
  const host = process.env.MCP_HOST?.trim() || '127.0.0.1';

  if (mode === 'stdio') {
    startStdioServer();
    return;
  }

  startHttpServer(Number.isFinite(port) ? port : 4005, host);
}

void main();
