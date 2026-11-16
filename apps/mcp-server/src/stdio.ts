import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './create-server.js';

export function startStdioServer(): void {
  // Errors and startup logs must go to stderr — stdout is the MCP protocol stream.
  serveStdio(createServer, { legacy: 'serve' });
}
