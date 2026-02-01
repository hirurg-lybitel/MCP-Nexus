import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import dotenv from "dotenv";
dotenv.config();

import { startMcpServer } from './lib/mcp/server';
import { MCP_PORT, PORT } from './constants';

console.log('NODE_ENV', process.env.NODE_ENV);
console.log('PORT', PORT);
console.log('HOSTNAME', process.env.HOSTNAME);
console.log('NEXT_PUBLIC_MCP_PORT', process.env.NEXT_PUBLIC_MCP_PORT);

const port = parseInt(PORT, 10);
const mcpPort = parseInt(MCP_PORT, 10);
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';

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
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
