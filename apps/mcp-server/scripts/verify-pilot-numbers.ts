import './../src/load-env.js';
import { addMoney, formatMoney } from '../src/lib/money.js';

const key = process.env.MCP_API_KEY!;
const headers = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: 'Bearer ' + key,
};

async function rpc(body: Record<string, unknown>) {
  const res = await fetch('http://127.0.0.1:4005/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const dataLine = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .pop();
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
}

function sc(call: { result?: { structuredContent?: Record<string, unknown>; isError?: boolean } }) {
  return call.result?.structuredContent ?? {};
}

await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'pilot-check', version: '0' },
  },
});

async function call(name: string, args: Record<string, unknown>) {
  const res = await rpc({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1e9),
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return sc(res);
}

const companyKey = 148284864;

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
const bal51 = await call('get_balance', {
  companyKey,
  accountKey: 355100,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal51_28 = await call('get_balance', {
  companyKey,
  accountKey: 355100,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal62_28 = await call('get_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal60_28 = await call('get_balance', {
  companyKey,
  accountKey: 366000,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});

const jo = await call('get_journal_order', {
  companyKey,
  accountKey: 355100,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  groupBy: 'MONTH',
  withSubAccounts: true,
});

const tb = await call('get_trial_balance', {
  companyKey,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  accountAliases: ['50-62'],
  includeOffBalance: false,
});

const tbFull = await call('get_trial_balance', {
  companyKey,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
});

const an90 = await call('get_account_analysis', {
  companyKey,
  accountKey: 344600,
  dateBegin: '2025-01-01',
  dateEnd: '2025-12-31',
  withSubAccounts: true,
});

const debtors = await call('get_analytics_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  side: 'debit',
  limit: 5,
});

const debtorsCutoff = await call('get_analytics_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2026-10-31',
  fieldName: 'USR$GS_CUSTOMER',
  side: 'debit',
  limit: 3,
});

const joRow = (jo.rows as Array<Record<string, unknown>> | undefined)?.[0];
const anRows = (an90.rows as Array<Record<string, unknown>> | undefined) ?? [];

console.log(
  JSON.stringify(
    {
      D1: {
        '62_debitNcu': bal62.totals && (bal62.totals as any).debitNcu,
        '62_creditNcu': bal62.totals && (bal62.totals as any).creditNcu,
        '62_simple': bal62.totals && (bal62.totals as any).simpleNcu,
        '60_debitNcu': bal60.totals && (bal60.totals as any).debitNcu,
        '60_creditNcu': bal60.totals && (bal60.totals as any).creditNcu,
        '60_simple': bal60.totals && (bal60.totals as any).simpleNcu,
        chatSaid: { buyers: '823.864', suppliers: '1933.1951' },
      },
      A4: {
        toolDebit: joRow?.ncuDebit,
        toolCredit: joRow?.ncuCredit,
        chatSaid: { debit: '2816952.18', credit: '2849376.99' },
      },
      B5: {
        totals: tb.totals,
        rowCount: tb.rowCount,
        chatSaidBeginDebit: '4509881.4261',
      },
      A1: {
        totals: tbFull.totals,
        rowCount: tbFull.rowCount,
        includeOffBalance: tbFull.includeOffBalance,
      },
      C2_B1: {
        '51_2025-12-31': bal51.totals,
        '51_2025-12-28': bal51_28.totals,
        '62_2025-12-28': bal62_28.totals,
        '60_2025-12-28': bal60_28.totals,
      },
      A3_90: {
        rowCount: an90.rowCount,
        saldoEnd: an90.saldoEndNcu,
        sample: anRows.slice(0, 8).map((r) => ({
          alias: r.alias ?? r.ALIAS,
          name: r.accountName ?? r.ACCOUNT_NAME,
          debit: r.ncuDebit ?? r.NCU_DEBIT,
          credit: r.ncuCredit ?? r.NCU_CREDIT,
        })),
      },
      D3_dates: {
        debtors_2025_12_31: ((debtors.rows as any[]) ?? []).slice(0, 3).map((r) => ({
          name: r.analyticsName ?? r.name,
          debit: r.debitNcu ?? r.simpleNcu,
        })),
        debtors_cutoff: ((debtorsCutoff.rows as any[]) ?? []).slice(0, 3).map((r) => ({
          name: r.analyticsName ?? r.name,
          debit: r.debitNcu ?? r.simpleNcu,
        })),
        totals31: debtors.totals,
        totalsCutoff: debtorsCutoff.totals,
      },
    },
    null,
    2
  )
);

void addMoney;
void formatMoney;
