import './../src/load-env.js';

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

await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'a2b2', version: '0' },
  },
});

async function call(name: string, args: Record<string, unknown>) {
  const res = await rpc({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1e9),
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return res.result?.structuredContent ?? {};
}

const companyKey = 148284864;
const a60 = await call('get_analytics_balance', {
  companyKey,
  accountKey: 366000,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  withSubAccounts: true,
  limit: 5,
});
const a62 = await call('get_analytics_balance', {
  companyKey,
  accountKey: 366200,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  withSubAccounts: true,
  limit: 5,
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

console.log(
  JSON.stringify(
    {
      analytics60_totals: a60.totals,
      analytics60_rowCount: a60.rowCount,
      analytics62_totals: a62.totals,
      nov62: {
        saldoBegin: n62.saldoBeginNcu,
        saldoEnd: n62.saldoEndNcu,
        // turnovers may be in rows or dedicated fields
        keys: Object.keys(n62),
        debit: n62.ncuDebit ?? n62.debitNcu ?? n62.turnoverDebitNcu,
        credit: n62.ncuCredit ?? n62.creditNcu ?? n62.turnoverCreditNcu,
      },
      dec62: {
        keys: Object.keys(d62),
        debit: d62.ncuDebit ?? d62.debitNcu ?? d62.turnoverDebitNcu,
        credit: d62.ncuCredit ?? d62.creditNcu ?? d62.turnoverCreditNcu,
        saldoBeginDebit: d62.saldoBeginDebitNcu,
        saldoBeginCredit: d62.saldoBeginCreditNcu,
        saldoEndDebit: d62.saldoEndDebitNcu,
        saldoEndCredit: d62.saldoEndCreditNcu,
      },
    },
    null,
    2
  )
);
