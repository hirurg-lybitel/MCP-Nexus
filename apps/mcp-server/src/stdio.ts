import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './create-server.js';

export function startStdioServer(): void {
  serveStdio(createServer, { legacy: 'serve' });
}
