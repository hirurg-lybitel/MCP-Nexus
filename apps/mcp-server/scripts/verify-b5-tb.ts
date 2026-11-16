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
    clientInfo: { name: 'b5', version: '0' },
  },
});

const t0 = Date.now();
const call = await rpc({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'get_trial_balance',
    arguments: {
      companyKey: 148284864,
      dateBegin: '2025-12-01',
      dateEnd: '2025-12-31',
      accountAliases: ['50-62'],
      includeOffBalance: false,
    },
  },
});

const sc = call.result?.structuredContent as Record<string, unknown> | undefined;
const accounts = (sc?.accounts as Array<Record<string, unknown>> | undefined) ?? [];
const aliases = accounts.map((a) => String(a.ACCOUNT_ALIAS ?? ''));
const roots = [
  ...new Set(
    aliases.map((a) => {
      const m = /^(\d+)/.exec(a);
      return m ? m[1] : a;
    })
  ),
].sort((a, b) => Number(a) - Number(b));
const off = accounts.filter((a) => Number(a.OFFBALANCE ?? 0) !== 0);

console.log(
  JSON.stringify(
    {
      ms: Date.now() - t0,
      isError: call.result?.isError,
      source: sc?.source,
      rowCount: sc?.rowCount,
      roots,
      has60: aliases.some((a) => a === '60' || a.startsWith('60.') || a.startsWith('60-')),
      has62: aliases.some((a) => a === '62' || a.startsWith('62.') || a.startsWith('62-')),
      has90: aliases.some((a) => a.startsWith('90')),
      offbalanceRows: off.length,
      includeOffBalance: sc?.includeOffBalance,
      accountAliases: sc?.accountAliases,
      totals: sc?.totals,
      sample: aliases.slice(0, 15),
      error: sc?.error || sc?.code,
    },
    null,
    2
  )
);
