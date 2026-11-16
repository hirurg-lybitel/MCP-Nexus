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

const init = await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'roi-live', version: '0' },
  },
});
const instructions: string = init.result?.instructions ?? '';

async function call(name: string, args: Record<string, unknown>) {
  const res = await rpc({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1e9),
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return res.result ?? {};
}

const companyKey = 148284864;
const account60 = 366000;
const account601 = 148542117;
const dateEnd = '2025-12-31';
const fieldName = 'USR$GS_CUSTOMER';

const a601 = await call('get_analytics_balance', {
  companyKey,
  accountKey: account601,
  dateEnd,
  fieldName,
  withSubAccounts: false,
  limit: 5,
});
const b601 = await call('get_balance', {
  companyKey,
  accountKey: account601,
  dateEnd,
  fieldName,
  withSubAccounts: false,
});
const a60 = await call('get_analytics_balance', {
  companyKey,
  accountKey: account60,
  dateEnd,
  fieldName,
  withSubAccounts: true,
  limit: 3,
});
const b60 = await call('get_balance', {
  companyKey,
  accountKey: account60,
  dateEnd,
  fieldName,
  withSubAccounts: true,
});

const sc = (r: { structuredContent?: Record<string, unknown>; isError?: boolean }) =>
  r.structuredContent ?? {};

const a601t = (sc(a601).totals as Record<string, string>) ?? {};
const b601t = (sc(b601).totals as Record<string, string>) ?? {};
const a60t = (sc(a60).totals as Record<string, string>) ?? {};
const b60t = (sc(b60).totals as Record<string, string>) ?? {};

function matchTotals(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  return a.debitNcu === b.debitNcu && a.creditNcu === b.creditNcu;
}

console.log(
  JSON.stringify(
    {
      instructions: {
        hasMonthRule: /groupBy MONTH|Не суммируй сам дневные/i.test(instructions),
        hasDzKzRule: /дебиторка покупателей|totals\.creditNcu счёта 60/i.test(
          instructions
        ),
        hasNoGuessCustomer: /не подставляй USR\$GS_CUSTOMER наугад/i.test(
          instructions
        ),
        has90NotRevenue: /не выручка/i.test(instructions),
      },
      analytics601: {
        isError: a601.isError,
        source: sc(a601).source,
        closeDate: sc(a601).closeDate,
        totals: a601t,
        top: ((sc(a601).rows as unknown[]) ?? []).slice(0, 2),
      },
      balance601: { isError: b601.isError, totals: b601t },
      match601: matchTotals(a601t, b601t),
      analytics60tree: {
        isError: a60.isError,
        source: sc(a60).source,
        totals: a60t,
        availableFields: sc(a60).availableFields,
      },
      balance60field: { isError: b60.isError, totals: b60t },
      match60tree: matchTotals(a60t, b60t),
    },
    null,
    2
  )
);
