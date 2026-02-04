import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { startMcpServer } from './lib/mcp/server';
import { MCP_PORT, PORT, HOST } from './constants';
import dotenv from "dotenv";
dotenv.config();

const port = Number.parseInt(PORT, 10);
const mcpPort = Number.parseInt(MCP_PORT, 10);
const dev = process.env.NODE_ENV !== 'production';
const hostname = HOST || 'localhost';

const app = next({ dev, hostname, port, customServer: true  });
const handle = app.getRequestHandler();

startMcpServer(mcpPort);

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err?: Error) => {
    if (err) throw err;
    console.log(`> Ready on http://${HOST}:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
