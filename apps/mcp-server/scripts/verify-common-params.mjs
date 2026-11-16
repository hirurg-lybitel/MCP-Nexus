import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServer } from '../src/create-server.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}
process.env.GEDEMIN_WORKER_TIMEOUT_MS ||= '180000';

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

async function call(name, args, id) {
  const res = await fetchHandler(
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    })
  );
  const json = await readJsonRpc(res);
  const result = json.result;
  let sc = result?.structuredContent;
  if (!sc && result?.content?.[0]?.text) sc = JSON.parse(result.content[0].text);
  const ok = !json.error && !result?.isError && !sc?.error;
  return { ok, sc, error: json.error ?? sc };
}

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
        clientInfo: { name: 'verify-common-params', version: '0.0.1' },
      },
    }),
  })
);

const base = {
  companyKey: 148284864,
  accountKey: 366201,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-28',
  withSubAccounts: false,
  limit: 3,
};

const card = await call('get_account_card', base, 2);
console.log(
  `[${card.ok ? 'OK' : 'FAIL'}] get_account_card:`,
  JSON.stringify({
    filters: card.sc?.appliedFilters,
    rowCount: card.sc?.rowCount,
    error: card.ok ? undefined : card.error,
  })
);

const analysis = await call(
  'get_account_analysis',
  {
    companyKey: base.companyKey,
    accountKey: base.accountKey,
    dateBegin: base.dateBegin,
    dateEnd: base.dateEnd,
    withSubAccounts: false,
  },
  3
);
console.log(
  `[${analysis.ok ? 'OK' : 'FAIL'}] get_account_analysis:`,
  JSON.stringify({
    filters: analysis.sc?.appliedFilters,
    rowCount: analysis.sc?.rowCount,
    error: analysis.ok ? undefined : analysis.error,
  })
);

await handler.close?.();
if (!card.ok || !analysis.ok) process.exitCode = 1;
