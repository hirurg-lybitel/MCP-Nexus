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
process.env.FIREBIRD_QUERY_TIMEOUT_MS ||= '180000';
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
        clientInfo: { name: 'verify-mvp4', version: '0.0.1' },
      },
    }),
  })
);

const companyKey = 148284864;
const checks = [];

const chart = await call(
  'get_chart_of_accounts',
  { companyKey, query: '62', depth: 2, limit: 20 },
  2
);
checks.push([
  'get_chart_of_accounts',
  chart.ok && (chart.sc?.rowCount ?? 0) > 0,
  {
    rowCount: chart.sc?.rowCount,
    first: chart.sc?.accounts?.[0],
    analytics: chart.sc?.accounts?.find((a) => (a.analytics?.length ?? 0) > 0)?.analytics?.[0],
    error: chart.ok ? undefined : chart.error,
  },
]);

const balance = await call(
  'get_balance',
  { companyKey, accountKey: 366201, dateEnd: '2025-12-28' },
  3
);
checks.push([
  'get_balance',
  balance.ok && balance.sc?.totals != null,
  {
    totals: balance.sc?.totals,
    filters: balance.sc?.appliedFilters,
    error: balance.ok ? undefined : balance.error,
  },
]);

const list = await call(
  'list_report_configs',
  { className: 'TAccCardConfig', limit: 5 },
  4
);
const configId = Number(list.sc?.configs?.[0]?.id);
checks.push([
  'list_report_configs',
  list.ok && (list.sc?.rowCount ?? 0) > 0,
  {
    rowCount: list.sc?.rowCount,
    first: list.sc?.configs?.[0],
    error: list.ok ? undefined : list.error,
  },
]);

if (configId > 0) {
  const run = await call(
    'run_report_config',
    {
      configId,
      companyKey,
      dateBegin: '2025-12-01',
      dateEnd: '2025-12-28',
      limit: 5,
    },
    5
  );
  checks.push([
    'run_report_config',
    run.ok,
    {
      source: run.sc?.source,
      reportClass: run.sc?.reportClass,
      rowCount: run.sc?.rowCount,
      columns: run.sc?.columns?.slice?.(0, 8),
      error: run.ok ? undefined : run.error,
    },
  ]);
} else {
  checks.push(['run_report_config', false, { error: 'no config id' }]);
}

for (const [name, ok, detail] of checks) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}: ${JSON.stringify(detail)}`);
}
await handler.close?.();
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
