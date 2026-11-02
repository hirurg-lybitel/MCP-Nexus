import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { requireMcpAuth, getMcpApiKey, isMcpAuthRequired } from './auth.js';
import { createServer } from './create-server.js';

export function startHttpServer(port: number, host = '127.0.0.1'): void {
  if (isMcpAuthRequired() && !getMcpApiKey()) {
    console.error('MCP_API_KEY is not set; HTTP endpoints will return 503.');
  }

  const handler = createMcpHandler(createServer, {
    legacy: 'stateless',
    responseMode: 'json',
  });
  const node = toNodeHandler(handler);
  const app = createMcpExpressApp({ host });

  app.use('/mcp', requireMcpAuth);
  app.all('/mcp', (req, res) => {
    void node(req, res, req.body);
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, name: 'mcp-nexus', transport: 'http' });
  });

  const server = app.listen(port, host, () => {
    console.log(`MCP HTTP listening on http://${host}:${port}/mcp`);
  });

  const shutdown = async () => {
    await handler.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
