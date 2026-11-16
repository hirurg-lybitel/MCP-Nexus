import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServer } from '../src/create-server.ts';
import { setAuditTransport } from '../src/lib/audit.ts';
import '../src/load-env.ts';

const dir = await mkdtemp(join(tmpdir(), 'mcp-audit-live-'));
const logPath = join(dir, 'a.jsonl');
process.env.MCP_AUDIT_LOG = logPath;
setAuditTransport('stdio');

async function readJsonRpc(res) {
  const body = await res.text();
  const ctype = res.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) return JSON.parse(body);
  const dataLines = body
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  return JSON.parse(dataLines.at(-1));
}

const handler = createMcpHandler(createServer, {
  legacy: 'stateless',
  responseMode: 'json',
});
const fetchHandler = (req) => handler.fetch(req);

await fetchHandler(
  new Request('http://127.0.0.1/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'verify-audit', version: '0' },
      },
    }),
  })
);

const callRes = await fetchHandler(
  new Request('http://127.0.0.1/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'find_account',
        arguments: { query: '62', limit: 1 },
      },
    }),
  })
);
const callJson = await readJsonRpc(callRes);
console.log('call_ok', !callJson.error && !callJson.result?.isError);

await new Promise((r) => setTimeout(r, 300));
const text = await readFile(logPath, 'utf8');
console.log('audit', text.trim());
await handler.close?.();
await rm(dir, { recursive: true, force: true });
