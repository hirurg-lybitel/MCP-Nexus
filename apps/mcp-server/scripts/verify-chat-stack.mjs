/**
 * End-to-end smoke for chat stack: MCP HTTP + BFF + DB tools on BG.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const key = env.MCP_API_KEY;
if (!key) {
  console.error('MCP_API_KEY missing');
  process.exit(1);
}

async function readJson(res) {
  const ctype = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (ctype.includes('application/json')) return JSON.parse(text);
  const dataLines = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  return JSON.parse(dataLines.at(-1) ?? text);
}

async function mcpCall(base, name, args, id) {
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const json = await readJson(res);
  const result = json.result;
  let sc = result?.structuredContent;
  if (!sc && result?.content?.[0]?.text) {
    try {
      sc = JSON.parse(result.content[0].text);
    } catch {
      sc = { raw: result.content[0].text };
    }
  }
  const ok = res.ok && !json.error && !result?.isError && !sc?.error;
  return { ok, status: res.status, sc, error: json.error ?? sc?.error };
}

async function initialize(base) {
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'verify-chat-stack', version: '0' },
      },
    }),
  });
  const json = await readJson(res);
  return json.result;
}

const checks = [];

// 1) MCP health + ready
{
  const health = await fetch('http://127.0.0.1:4005/health').then((r) => r.json());
  checks.push(['mcp /health', health.ok === true, health]);
  const ready = await fetch('http://127.0.0.1:4005/ready').then((r) => r.json());
  checks.push([
    'mcp /ready',
    ready.ok === true && ready.firebird === true && ready.worker?.loginOk === true,
    ready,
  ]);
}

const mcpBase = 'http://127.0.0.1:4005/mcp';
const init = await initialize(mcpBase);
checks.push([
  'mcp initialize instructions',
  typeof init?.instructions === 'string' &&
    /get_trial_balance|get_chart_of_accounts|Гедымин|Gedemin/i.test(init.instructions),
  { hasInstructions: Boolean(init?.instructions), len: init?.instructions?.length },
]);

const listRes = await fetch(mcpBase, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  }),
});
const listJson = await readJson(listRes);
const toolNames = (listJson.result?.tools ?? []).map((t) => t.name);
const needed = [
  'get_chart_of_accounts',
  'get_balance',
  'run_sql',
  'find_account',
  'list_report_configs',
];
checks.push([
  'mcp tools/list v2',
  needed.every((n) => toolNames.includes(n)),
  { count: toolNames.length, missing: needed.filter((n) => !toolNames.includes(n)) },
]);

const companyKey = 148284864;
const chart = await mcpCall(
  mcpBase,
  'get_chart_of_accounts',
  { companyKey, query: '62', limit: 5 },
  3
);
checks.push([
  'get_chart_of_accounts',
  chart.ok && (chart.sc?.rowCount ?? 0) > 0,
  { rowCount: chart.sc?.rowCount, first: chart.sc?.accounts?.[0]?.alias, error: chart.error },
]);

const find = await mcpCall(mcpBase, 'find_account', { query: '62', companyKey, limit: 3 }, 4);
checks.push([
  'find_account',
  find.ok && (find.sc?.rowCount ?? 0) > 0,
  { rowCount: find.sc?.rowCount, first: find.sc?.accounts?.[0], error: find.error },
]);

const sql = await mcpCall(
  mcpBase,
  'run_sql',
  { sql: 'SELECT COUNT(*) AS CNT FROM AC_ENTRY' },
  5
);
checks.push([
  'run_sql COUNT AC_ENTRY',
  sql.ok && sql.sc?.rows?.[0] != null,
  { rows: sql.sc?.rows, error: sql.error },
]);

// BFF (web)
const bffInit = await fetch('http://127.0.0.1:4004/api/mcp/instructions', {
  headers: { authorization: `Bearer ${key}` },
}).then(async (r) => ({ status: r.status, body: await r.json() }));
checks.push([
  'web BFF /api/mcp/instructions',
  bffInit.status === 200 &&
    bffInit.body?.ok === true &&
    typeof bffInit.body?.instructions === 'string' &&
    bffInit.body.instructions.length > 20,
  {
    status: bffInit.status,
    len: bffInit.body?.instructions?.length,
    upstream: bffInit.body?.upstream,
    error: bffInit.body?.error,
  },
]);

const authStatus = await fetch('http://127.0.0.1:4004/api/settings/mcp-auth-status').then(
  (r) => r.json()
);
checks.push([
  'web mcp-auth-status',
  authStatus.authRequired === true || authStatus.authRequired === false,
  authStatus,
]);

for (const [name, ok, detail] of checks) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}: ${JSON.stringify(detail)}`);
}
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log('\nAll stack checks passed. Open http://localhost:4004/chat');
