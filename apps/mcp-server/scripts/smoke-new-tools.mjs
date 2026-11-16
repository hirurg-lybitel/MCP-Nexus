import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '../..');
for (const line of readFileSync(resolve(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
}
process.env.NODE_FB_HOST = 'localhost';

const { createMcpHandler } = await import('@modelcontextprotocol/server');
const { createServer } = await import(
  pathToFileURL(resolve(appRoot, 'src/create-server.ts')).href
);

const handler = createMcpHandler(createServer, {
  legacy: 'stateless',
  responseMode: 'json',
});

async function rpc(id, method, params) {
  const res = await handler.fetch(
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
  );
  const ctype = res.headers.get('content-type') ?? '';
  const body = await res.text();
  if (ctype.includes('application/json')) return JSON.parse(body);
  const dataLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  return JSON.parse(dataLines[dataLines.length - 1]);
}

function sc(result) {
  if (result?.structuredContent) return result.structuredContent;
  if (result?.content?.[0]?.text) return JSON.parse(result.content[0].text);
  return result;
}

await rpc(1, 'initialize', {
  protocolVersion: '2025-03-26',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0' },
});

const card = await rpc(2, 'tools/call', {
  name: 'get_account_card',
  arguments: {
    companyKey: 146866007,
    dateBegin: '2023-01-01',
    dateEnd: '2023-10-31',
    accountKey: 366200,
    limit: 3,
  },
});
const c = sc(card.result);
console.log('card', {
  rowCount: c.rowCount,
  truncated: c.truncated,
  dataCutoff: c.dataCutoff,
  sample: c.entries?.[0],
  error: c.error,
});

const saldo = await rpc(3, 'tools/call', {
  name: 'get_account_saldo',
  arguments: {
    companyKey: 146866007,
    accountKey: 366200,
    dateEnd: '2023-10-31',
  },
});
console.log('saldo', sc(saldo.result));

const item = await rpc(4, 'tools/call', {
  name: 'find_item',
  arguments: { query: 'Акт', limit: 3 },
});
console.log('item', sc(item.result));

const jo = await rpc(5, 'tools/call', {
  name: 'get_journal_order',
  arguments: {
    companyKey: 146866007,
    dateBegin: '2023-01-01',
    dateEnd: '2023-10-31',
    accountKey: 366200,
    groupBy: 'MONTH',
  },
});
const j = sc(jo.result);
console.log('journal', {
  source: j.source,
  rowCount: j.rowCount,
  sample: j.rows?.[0],
  error: j.error,
});

await handler.close();
