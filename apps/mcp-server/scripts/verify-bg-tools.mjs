/**
 * End-to-end check of MCP tools against the connected NODE_FB_DB + report worker.
 * Does not print secrets.
 */
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

function payload(toolResult) {
  let sc = toolResult?.structuredContent;
  if (!sc && toolResult?.content?.[0]?.text) {
    sc = JSON.parse(toolResult.content[0].text);
  }
  return sc;
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
  if (json.error) {
    return { ok: false, detail: json.error };
  }
  const result = json.result;
  const sc = payload(result);
  if (result?.isError || sc?.error) {
    return { ok: false, detail: sc ?? result };
  }
  return { ok: true, detail: sc };
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
        clientInfo: { name: 'verify-bg', version: '0.0.1' },
      },
    }),
  })
);

const company = await call(
  'run_sql',
  {
    sql: `SELECT FIRST 1 c.id AS company_id, c.name AS company_name, ca.accountkey AS chart_id
FROM ac_companyaccount ca
JOIN gd_contact c ON c.id = ca.companykey
WHERE ca.isactive = 1
ORDER BY c.name`,
  },
  2
);

const companyRow = company.detail?.rows?.[0];
const companyKey = Number(companyRow?.COMPANY_ID ?? companyRow?.company_id);
const checks = [
  [
    'run_sql company',
    company.ok && companyKey > 0,
    {
      companyKey,
      name: companyRow?.COMPANY_NAME ?? companyRow?.company_name,
      chart: companyRow?.CHART_ID ?? companyRow?.chart_id,
      db: process.env.NODE_FB_DB,
    },
  ],
];

const findAccount = await call('find_account', { query: '62', limit: 3 }, 3);
checks.push([
  'find_account 62',
  findAccount.ok && (findAccount.detail?.rowCount ?? 0) > 0,
  {
    rowCount: findAccount.detail?.rowCount,
    first: findAccount.detail?.accounts?.[0],
    error: findAccount.detail,
  },
]);

const accountKey = Number(
  findAccount.detail?.accounts?.find((a) => String(a.alias).startsWith('62'))?.id ??
    findAccount.detail?.accounts?.[0]?.id
);

const findCp = await call('find_counterparty', { query: 'Бел', limit: 3 }, 4);
checks.push([
  'find_counterparty',
  findCp.ok && (findCp.detail?.rowCount ?? 0) > 0,
  { rowCount: findCp.detail?.rowCount, first: findCp.detail?.counterparties?.[0] },
]);

const findDt = await call('find_document_type', { query: 'акт', limit: 2 }, 5);
checks.push([
  'find_document_type',
  findDt.ok && (findDt.detail?.rowCount ?? 0) > 0,
  { rowCount: findDt.detail?.rowCount },
]);

const findItem = await call('find_item', { query: 'услуг', limit: 2 }, 6);
checks.push([
  'find_item',
  findItem.ok && (findItem.detail?.rowCount ?? 0) > 0,
  { rowCount: findItem.detail?.rowCount },
]);

const analytics = await call(
  'find_analytics_value',
  { fieldName: 'USR$GS_CUSTOMER', query: 'ООО', limit: 2 },
  7
);
checks.push([
  'find_analytics_value',
  analytics.ok && (analytics.detail?.rowCount ?? 0) >= 0,
  {
    ok: analytics.ok,
    rowCount: analytics.detail?.rowCount,
    refTable: analytics.detail?.refTable,
    error: analytics.ok ? undefined : analytics.detail,
  },
]);

const tb = await call(
  'get_trial_balance',
  { companyKey, dateBegin: '2025-12-01', dateEnd: '2025-12-28' },
  8
);
checks.push([
  'get_trial_balance',
  tb.ok && (tb.detail?.rowCount ?? 0) > 0,
  {
    source: tb.detail?.source,
    rowCount: tb.detail?.rowCount,
    totals: tb.detail?.totals,
    error: tb.ok ? undefined : tb.detail,
  },
]);

const saldo = await call(
  'get_account_saldo',
  { companyKey, accountKey, dateEnd: '2025-12-28' },
  9
);
checks.push([
  'get_account_saldo',
  saldo.ok && (saldo.detail?.rowCount ?? 0) > 0,
  {
    source: saldo.detail?.source,
    totals: saldo.detail?.totals,
    error: saldo.ok ? undefined : saldo.detail,
  },
]);

const card = await call(
  'get_account_card',
  {
    companyKey,
    accountKey,
    dateBegin: '2025-12-01',
    dateEnd: '2025-12-28',
    limit: 5,
  },
  10
);
checks.push([
  'get_account_card',
  card.ok,
  {
    source: card.detail?.source,
    rowCount: card.detail?.rowCount,
    error: card.ok ? undefined : card.detail,
  },
]);

const analysis = await call(
  'get_account_analysis',
  {
    companyKey,
    accountKey,
    dateBegin: '2025-12-01',
    dateEnd: '2025-12-28',
  },
  11
);
checks.push([
  'get_account_analysis',
  analysis.ok,
  {
    source: analysis.detail?.source,
    rowCount: analysis.detail?.rowCount,
    saldoEndNcu: analysis.detail?.saldoEndNcu,
    error: analysis.ok ? undefined : analysis.detail,
  },
]);

const journal = await call(
  'get_journal_order',
  {
    companyKey,
    accountKey,
    dateBegin: '2025-12-01',
    dateEnd: '2025-12-28',
    groupBy: 'NONE',
  },
  12
);
checks.push([
  'get_journal_order',
  journal.ok,
  {
    source: journal.detail?.source,
    rowCount: journal.detail?.rowCount,
    error: journal.ok ? undefined : journal.detail,
  },
]);

const docs = await call(
  'get_documents',
  {
    companyKey,
    dateBegin: '2025-12-01',
    dateEnd: '2025-12-28',
    limit: 1,
  },
  13
);
const docId = Number(docs.detail?.documents?.[0]?.ID ?? docs.detail?.documents?.[0]?.id);
checks.push([
  'get_documents',
  docs.ok && (docs.detail?.rowCount ?? 0) > 0,
  {
    rowCount: docs.detail?.rowCount,
    firstId: docId,
    error: docs.ok ? undefined : docs.detail,
  },
]);

if (docId > 0) {
  const doc = await call('get_document', { documentId: docId }, 14);
  checks.push([
    'get_document',
    doc.ok && doc.detail?.document != null,
    {
      entryCount: doc.detail?.entries?.length,
      error: doc.ok ? undefined : doc.detail,
    },
  ]);
} else {
  checks.push(['get_document', false, { error: 'no document id' }]);
}

for (const [name, ok, detail] of checks) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}: ${JSON.stringify(detail)}`);
}

await handler.close?.();
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
