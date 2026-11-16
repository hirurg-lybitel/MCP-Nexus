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
    clientInfo: { name: 'bug15', version: '0' },
  },
});

const call = await rpc({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'run_sql',
    arguments: {
      sql: `SELECT FIRST 3
  EXTRACT(MONTH FROM e.entrydate) AS m,
  CAST(SUM(e.debitncu) AS NUMERIC(18,4)) AS debit
FROM ac_entry e
WHERE e.entrydate >= DATE '2025-12-01'
  AND e.entrydate <= DATE '2025-12-31'
  AND e.companykey = 148284864
GROUP BY 1
ORDER BY 1`,
    },
  },
});

const sc = call.result?.structuredContent as Record<string, unknown> | undefined;
console.log(
  JSON.stringify(
    {
      isError: call.result?.isError,
      code: sc?.code,
      error: sc?.error,
      rowCount: sc?.rowCount ?? (sc?.rows as unknown[] | undefined)?.length,
      sample: (sc?.rows as unknown[] | undefined)?.slice?.(0, 3) ?? sc?.rows,
    },
    null,
    2
  )
);
