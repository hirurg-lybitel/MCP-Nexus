import './load-env.js';
import { startHttpServer } from './http.js';
import { startStdioServer } from './stdio.js';

const mode = (process.argv[2] ?? 'http').toLowerCase();
const port = Number.parseInt(process.env.MCP_PORT ?? '4005', 10);
const host = process.env.MCP_HOST?.trim() || '127.0.0.1';

if (mode === 'stdio') {
  startStdioServer();
} else if (mode === 'http') {
  startHttpServer(Number.isFinite(port) ? port : 4005, host);
} else {
  console.error(`Unknown mode "${mode}". Use: http | stdio`);
  process.exit(1);
}
