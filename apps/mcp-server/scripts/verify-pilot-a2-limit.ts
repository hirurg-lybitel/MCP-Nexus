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
    clientInfo: { name: 'a2l', version: '0' },
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

const a5 = await call('get_analytics_balance', {
  companyKey: 148284864,
  accountKey: 366000,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  withSubAccounts: true,
  limit: 5,
});
const a500 = await call('get_analytics_balance', {
  companyKey: 148284864,
  accountKey: 366000,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  withSubAccounts: true,
  limit: 500,
});
const bal = await call('get_balance', {
  companyKey: 148284864,
  accountKey: 366000,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});

console.log(
  JSON.stringify(
    {
      limit5: { rowCount: a5.rowCount, totals: a5.totals, truncated: a5.truncated },
      limit500: {
        rowCount: a500.rowCount,
        totals: a500.totals,
        truncated: a500.truncated,
      },
      get_balance: bal.totals,
    },
    null,
    2
  )
);
