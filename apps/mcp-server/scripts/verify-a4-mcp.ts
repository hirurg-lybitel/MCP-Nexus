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
    clientInfo: { name: 'a4', version: '0' },
  },
});

const t0 = Date.now();
const call = await rpc({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'get_journal_order',
    arguments: {
      companyKey: 148284864,
      accountKey: 355100,
      dateBegin: '2025-12-01',
      dateEnd: '2025-12-31',
      groupBy: 'MONTH',
    },
  },
});
const sc = call.result?.structuredContent as Record<string, unknown> | undefined;
const row0 = (sc?.rows as Array<Record<string, unknown>> | undefined)?.[0];
console.log(
  JSON.stringify(
    {
      ms: Date.now() - t0,
      isError: call.result?.isError,
      source: sc?.source,
      rowCount: sc?.rowCount,
      ncuDebit: row0?.ncuDebit,
      ncuCredit: row0?.ncuCredit,
      corrCount: Array.isArray(row0?.correspondence)
        ? row0.correspondence.length
        : 0,
      error: sc?.error || sc?.code,
    },
    null,
    2
  )
);
