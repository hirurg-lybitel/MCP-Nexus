import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const base = process.env.MCP_LIVE_URL ?? 'http://127.0.0.1:4005/mcp';
const apiKey = process.env.MCP_API_KEY?.trim();

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

async function readJsonRpc(res) {
  const ctype = res.headers.get('content-type') ?? '';
  const body = await res.text();
  if (ctype.includes('application/json')) return JSON.parse(body);
  const dataLines = body
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (!dataLines.length) throw new Error(`no SSE data: ${body.slice(0, 300)}`);
  return JSON.parse(dataLines[dataLines.length - 1]);
}

async function rpc(method, params, id) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return readJsonRpc(res);
}

function toolPayload(rpcResult) {
  if (rpcResult.error) throw new Error(JSON.stringify(rpcResult.error));
  const content = rpcResult.result?.content;
  const text = content?.find?.((c) => c.type === 'text')?.text;
  if (!text) return rpcResult.result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

await rpc(
  'initialize',
  {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'live-fb5-check', version: '0.0.1' },
  },
  1
);

const listed = await rpc('tools/list', {}, 2);
const toolNames = (listed.result?.tools ?? []).map((t) => t.name).sort();
record('tools/list', toolNames.length > 0, toolNames.join(', '));

async function callTool(name, args, id) {
  const r = await rpc('tools/call', { name, arguments: args }, id);
  return toolPayload(r);
}

// 1) Engine + dialect features on FB5
{
  const p = await callTool(
    'run_sql',
    {
      sql: `SELECT
        TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS engine_version,
        COUNT(*) AS entry_count
      FROM AC_ENTRY`,
    },
    10
  );
  const row = p.rows?.[0] ?? p.sampleRows?.[0] ?? {};
  const ver = String(row.ENGINE_VERSION ?? row.engine_version ?? '');
  const count = row.ENTRY_COUNT ?? row.entry_count;
  const ok = ver.startsWith('5.') && Number(count) > 0;
  record('run_sql ENGINE_VERSION + COUNT(AC_ENTRY)', ok, { ver, count, rowCount: p.rowCount });
}

// 2) Window function (FB5-only surface)
{
  try {
    const p = await callTool(
      'run_sql',
      {
        sql: `SELECT FIRST 3
          ACCOUNTKEY,
          DEBITNCU,
          SUM(DEBITNCU) OVER (PARTITION BY ACCOUNTKEY) AS part_sum
        FROM AC_ENTRY
        WHERE ENTRYDATE BETWEEN DATE '2023-01-01' AND DATE '2023-01-31'`,
      },
      11
    );
    const row = p.rows?.[0] ?? {};
    const part = row.PART_SUM ?? row.part_sum;
    record(
      'run_sql window OVER (FB5)',
      p.rowCount >= 1 && (typeof part === 'string' || typeof part === 'number'),
      { rowCount: p.rowCount, partSumType: typeof part, partSum: part }
    );
  } catch (e) {
    record('run_sql window OVER (FB5)', false, e instanceof Error ? e.message : e);
  }
}

// 3) GD_DOCUMENT readable (UDF computed fields)
{
  try {
    const p = await callTool(
      'run_sql',
      { sql: `SELECT COUNT(*) AS c FROM GD_DOCUMENT` },
      12
    );
    const c = p.rows?.[0]?.C ?? p.rows?.[0]?.c;
    record('run_sql COUNT(GD_DOCUMENT)', Number(c) > 0, { c });
  } catch (e) {
    record('run_sql COUNT(GD_DOCUMENT)', false, e instanceof Error ? e.message : e);
  }
}

// 4) Trial balance etalon Ampersant 2023
{
  const p = await callTool(
    'get_trial_balance',
    {
      companyKey: 146866007,
      dateBegin: '2023-01-01',
      dateEnd: '2023-10-31',
    },
    20
  );
  const accounts = p.accounts?.length ?? p.rows?.length ?? p.rowCount;
  const debit = String(p.totals?.debitNcu ?? p.totals?.debit ?? '');
  const credit = String(p.totals?.creditNcu ?? p.totals?.credit ?? '');
  const ok =
    !p.error &&
    Number(accounts) === 41 &&
    debit.replace(',', '.') === '515139.5' &&
    credit.replace(',', '.') === '168102.5';
  record('get_trial_balance Ampersant 2023', ok, {
    source: p.source,
    accounts,
    debit,
    credit,
    dataCutoff: p.dataCutoff,
    error: p.error,
  });
}

// 5) find_account
{
  const p = await callTool('find_account', { query: '51' }, 30);
  const rows = p.rows ?? p.accounts ?? [];
  record('find_account 51', !p.error && rows.length > 0, {
    count: rows.length,
    first: rows[0],
  });
}

// 6) find_counterparty
{
  const p = await callTool('find_counterparty', { query: 'Амперсант' }, 31);
  const rows = p.rows ?? [];
  record('find_counterparty Амперсант', !p.error && rows.length > 0, {
    count: rows.length,
    first: rows[0],
  });
}

// 7) get_documents
{
  const p = await callTool(
    'get_documents',
    {
      companyKey: 146866007,
      dateBegin: '2023-01-01',
      dateEnd: '2023-01-31',
      limit: 5,
    },
    40
  );
  record('get_documents Jan 2023', !p.error && (p.rowCount ?? p.rows?.length ?? 0) > 0, {
    rowCount: p.rowCount ?? p.rows?.length,
    dataCutoff: p.dataCutoff,
  });
}

// Optional account tools if present
for (const [name, args] of [
  [
    'get_account_saldo',
    {
      companyKey: 146866007,
      accountKey: 300051, // may differ — resolve via find if needed
      dateEnd: '2023-10-31',
    },
  ],
  [
    'get_account_card',
    {
      companyKey: 146866007,
      accountKey: 300051,
      dateBegin: '2023-01-01',
      dateEnd: '2023-01-31',
    },
  ],
]) {
  if (!toolNames.includes(name)) {
    record(name, true, 'skipped (not registered on this process)');
    continue;
  }
  try {
    const p = await callTool(name, args, 50 + Math.floor(Math.random() * 100));
    record(name, !p.error, {
      source: p.source,
      rowCount: p.rowCount ?? p.rows?.length,
      error: p.error,
      totals: p.totals,
    });
  } catch (e) {
    record(name, false, e instanceof Error ? e.message : e);
  }
}

const failed = results.filter((r) => !r.ok);
console.log('\n---');
console.log(`passed ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  process.exitCode = 1;
  console.error('FAILED:', failed.map((f) => f.name).join(', '));
}
