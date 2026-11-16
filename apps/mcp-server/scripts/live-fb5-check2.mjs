import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const base = 'http://127.0.0.1:4005/mcp';
const headers = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${process.env.MCP_API_KEY}`,
};

async function rpc(method, params, id) {
  const res = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const body = await res.text();
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('json')) return JSON.parse(body);
  const d = body
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  return JSON.parse(d.at(-1));
}

function payload(r) {
  if (r.error) throw new Error(JSON.stringify(r.error));
  const t = r.result?.content?.find((c) => c.type === 'text')?.text;
  return t ? JSON.parse(t) : r.result;
}

await rpc(
  'initialize',
  {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'live-fb5-2', version: '0' },
  },
  1
);

const sql = payload(
  await rpc(
    'tools/call',
    {
      name: 'run_sql',
      arguments: {
        sql: `SELECT COUNT(*) AS c,
                     CAST(SUM(DEBITNCU) AS NUMERIC(18,4)) AS d,
                     CAST(SUM(CREDITNCU) AS NUMERIC(18,4)) AS cr
              FROM AC_ENTRY
              WHERE ACCOUNTKEY = 355100
                AND ENTRYDATE BETWEEN DATE '2023-01-01' AND DATE '2023-01-31'`,
      },
    },
    2
  )
);
console.log('sql jan account 51', sql.rows?.[0]);

for (const [label, args] of [
  [
    'card jan',
    {
      companyKey: 146866007,
      accountKey: 355100,
      dateBegin: '2023-01-01',
      dateEnd: '2023-01-31',
    },
  ],
  [
    'card ytd',
    {
      companyKey: 146866007,
      accountKey: 355100,
      dateBegin: '2023-01-01',
      dateEnd: '2023-10-31',
    },
  ],
  [
    'analysis ytd',
    {
      companyKey: 146866007,
      accountKey: 355100,
      dateBegin: '2023-01-01',
      dateEnd: '2023-10-31',
    },
  ],
  [
    'journal ytd',
    {
      companyKey: 146866007,
      accountKey: 355100,
      dateBegin: '2023-01-01',
      dateEnd: '2023-10-31',
    },
  ],
]) {
  const tool =
    label.startsWith('card')
      ? 'get_account_card'
      : label.startsWith('analysis')
        ? 'get_account_analysis'
        : 'get_journal_order';
  const p = payload(
    await rpc('tools/call', { name: tool, arguments: args }, 10)
  );
  console.log(label, {
    source: p.source,
    rowCount: p.rowCount ?? p.rows?.length ?? p.entries?.length,
    error: p.error,
    code: p.code,
    totals: p.totals,
  });
}
