/**
 * Pilot etalon checks against container MCP at http://127.0.0.1:4005
 * Expected numbers from docs/specs/001-mcp-server-v2/pilot-bugs.md (BG_NEW_FB5).
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

const MCP = 'http://127.0.0.1:4005/mcp';
const companyKey = 148284864;

async function rpc(body, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(MCP, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      const text = await res.text();
      const dataLine = text
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .pop();
      return JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

function sc(result) {
  if (result?.structuredContent) return result.structuredContent;
  if (result?.content?.[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return { raw: result.content[0].text };
    }
  }
  return {};
}

async function call(name, args) {
  const res = await rpc({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1e9),
    method: 'tools/call',
    params: { name, arguments: args },
  });
  if (res.error) return { ok: false, error: res.error, data: null };
  const data = sc(res.result);
  const ok = !res.result?.isError && !data?.error;
  return { ok, data, error: data?.error ?? null, isError: !!res.result?.isError };
}

const results = [];
function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'verify-pilot-container', version: '0' },
  },
});

const ready = await fetch('http://127.0.0.1:4005/ready').then((r) => r.json());
check('ready.firebird', ready.ok && ready.firebird, { worker: ready.worker?.reachable });

const plist = await rpc({ jsonrpc: '2.0', id: 2, method: 'prompts/list', params: {} });
check('prompts/list', !plist.error, {
  count: plist.result?.prompts?.length ?? 0,
  error: plist.error,
});

const fa = await call('find_account', { query: '62', limit: 3 });
check('dataCutoff', fa.ok && fa.data?.dataCutoff === '2026-10-31', fa.data?.dataCutoff);

const bal62 = await call('get_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal60 = await call('get_balance', {
  companyKey,
  accountKey: 366000,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
check('D1 62.debitNcu', bal62.ok && bal62.data?.totals?.debitNcu === '823.864', bal62.data?.totals);
check('D1 60.creditNcu', bal60.ok && bal60.data?.totals?.creditNcu === '1933.1951', bal60.data?.totals);

const b62 = await call('get_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});
const b60 = await call('get_balance', {
  companyKey,
  accountKey: 366000,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});
check('B1 62.debit@28', b62.ok && b62.data?.totals?.debitNcu === '823.864', b62.data?.totals);
check('B1 60.credit@28', b60.ok && b60.data?.totals?.creditNcu === '621134.608', b60.data?.totals);

const debt = await call('get_analytics_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  side: 'debit',
  limit: 5,
});
const rows = debt.data?.rows ?? [];
const d3ok =
  debt.ok &&
  String(rows[0]?.analyticsName ?? '').includes('МакВторВуд') &&
  String(rows[0]?.debitNcu) === '365.28' &&
  String(rows[1]?.analyticsName ?? '').includes('ГудАртАвто') &&
  String(rows[1]?.debitNcu) === '358.72' &&
  String(rows[2]?.analyticsName ?? '').includes('БелВТИ') &&
  String(rows[2]?.debitNcu) === '99.88';
check(
  'D3 top3',
  d3ok,
  rows.slice(0, 3).map((r) => ({ name: r.analyticsName, debit: r.debitNcu }))
);

const jo = await call('get_journal_order', {
  companyKey,
  accountKey: 355100,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  groupBy: 'MONTH',
  withSubAccounts: true,
});
const joRow = jo.data?.rows?.[0];
check('A4 JO 51 Dec', jo.ok && joRow?.ncuDebit != null && joRow?.ncuCredit != null, {
  debit: joRow?.ncuDebit,
  credit: joRow?.ncuCredit,
  source: jo.data?.source,
  error: jo.error,
});

const tb = await call('get_trial_balance', {
  companyKey,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  accountAliases: ['50-62'],
  includeOffBalance: false,
});
check('B5 TB 50-62', tb.ok && (tb.data?.rowCount ?? 0) > 0, {
  rowCount: tb.data?.rowCount,
  totals: tb.data?.totals,
  error: tb.error,
});

const n62 = await call('get_account_analysis', {
  companyKey,
  accountKey: 366200,
  dateBegin: '2025-11-01',
  dateEnd: '2025-11-30',
  withSubAccounts: true,
});
const d62 = await call('get_account_analysis', {
  companyKey,
  accountKey: 366200,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  withSubAccounts: true,
});
// B2: Nov ship 52.8 / pay 666.32; Dec ship 0 / pay 454.1
check(
  'B2 Nov 62',
  n62.ok &&
    String(n62.data?.turnoverDebitNcu) === '52.8' &&
    String(n62.data?.turnoverCreditNcu) === '666.32',
  {
    debit: n62.data?.turnoverDebitNcu,
    credit: n62.data?.turnoverCreditNcu,
    error: n62.error,
  }
);
check(
  'B2 Dec 62',
  d62.ok &&
    String(d62.data?.turnoverDebitNcu) === '0' &&
    String(d62.data?.turnoverCreditNcu) === '454.1',
  {
    debit: d62.data?.turnoverDebitNcu,
    credit: d62.data?.turnoverCreditNcu,
    error: d62.error,
  }
);

const an90 = await call('get_account_analysis', {
  companyKey,
  accountKey: 344600,
  dateBegin: '2025-01-01',
  dateEnd: '2025-12-31',
  withSubAccounts: true,
});
check('A3 analysis 90', an90.ok && (an90.data?.rowCount ?? 0) > 0, {
  rowCount: an90.data?.rowCount,
  error: an90.error,
});

const find10 = await call('find_account', { query: '10', limit: 20 });
const find20 = await call('find_account', { query: '20', limit: 20 });
const acc10 =
  (find10.data?.accounts ?? []).find((a) => String(a.alias) === '10') ??
  (find10.data?.accounts ?? [])[0];
const acc20 =
  (find20.data?.accounts ?? []).find((a) => String(a.alias) === '20') ??
  (find20.data?.accounts ?? [])[0];
const bal10 = acc10
  ? await call('get_balance', {
      companyKey,
      accountKey: acc10.id,
      dateEnd: '2025-12-31',
      withSubAccounts: true,
      summaryOnly: true,
    })
  : { ok: false, data: null };
const bal20 = acc20
  ? await call('get_balance', {
      companyKey,
      accountKey: acc20.id,
      dateEnd: '2025-12-31',
      withSubAccounts: true,
      summaryOnly: true,
    })
  : { ok: false, data: null };
function money2(v) {
  const n = Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n.toFixed(2) : '';
}
check(
  'D6 10 debit',
  bal10.ok && money2(bal10.data?.totals?.debitNcu) === '1794169.48',
  { alias: acc10?.alias, id: acc10?.id, totals: bal10.data?.totals }
);
check(
  'D6 20 debit',
  bal20.ok && money2(bal20.data?.totals?.debitNcu) === '907935.23',
  { alias: acc20?.alias, id: acc20?.id, totals: bal20.data?.totals }
);

const cfg = await call('list_report_configs', { limit: 5 });
check('A6 list_report_configs', cfg.ok && (cfg.data?.rowCount ?? 0) > 0, {
  rowCount: cfg.data?.rowCount,
  error: cfg.error,
});

const bal51 = await call('get_balance', {
  companyKey,
  accountKey: 355100,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
check('C2 money 51 tools ok', bal51.ok && bal51.data?.totals != null, bal51.data?.totals);

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\nSUMMARY pass=${passed} fail=${failed} total=${results.length}`);
process.exit(failed ? 1 : 0);
