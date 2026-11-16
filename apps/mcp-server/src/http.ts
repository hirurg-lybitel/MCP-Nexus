import { loadFirebirdConfig } from '@mcp-nexus/db-firebird';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  getDefaultAuthLimiter,
  getMcpApiKey,
  requireMcpAuth,
} from './auth.js';
import { createServer } from './create-server.js';
import { checkWorkerLogin } from './startup.js';

export function startHttpServer(port: number, host = '127.0.0.1'): void {
  if (!getMcpApiKey()) {
    throw new Error(
      'HTTP mode requires MCP_API_KEY (Authorization: Bearer <key>).'
    );
  }

  const handler = createMcpHandler(createServer, {
    legacy: 'stateless',
    responseMode: 'json',
  });
  const node = toNodeHandler(handler);
  const app = createMcpExpressApp({ host });
  const limiter = getDefaultAuthLimiter();

  app.use('/mcp', (req, res, next) => requireMcpAuth(req, res, next, limiter));
  app.all('/mcp', (req, res) => {
    void node(req, res, req.body);
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, name: 'mcp-nexus', transport: 'http' });
  });

  app.get('/ready', (_req, res) => {
    void (async () => {
      const fb = loadFirebirdConfig();
      const worker = await checkWorkerLogin();
      const ready = Boolean(fb) && Boolean(getMcpApiKey());
      res.status(ready ? 200 : 503).json({
        ok: ready,
        firebird: Boolean(fb),
        mcpApiKey: Boolean(getMcpApiKey()),
        worker: {
          configured: worker.configured,
          reachable: worker.reachable,
          loginOk: worker.ok,
          // message is safe (no password)
          message: worker.message,
        },
      });
    })();
  });

  const server = app.listen(port, host, () => {
    console.error(`MCP HTTP listening on http://${host}:${port}/mcp`);
  });

  const shutdown = async () => {
    await handler.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
