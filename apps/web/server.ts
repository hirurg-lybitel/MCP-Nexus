import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import dotenv from "dotenv";
import { startMcpServer } from './lib/mcp/server';
import { MCP_PORT, PORT } from './constants';

dotenv.config();

const port = parseInt(PORT || '4004', 10);
const mcpPort = parseInt(MCP_PORT || '4005', 10);
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';

const app = next({ dev, hostname, port });
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
