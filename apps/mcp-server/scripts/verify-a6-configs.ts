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
    clientInfo: { name: 'a6', version: '0' },
  },
});

async function list(className?: string) {
  const call = await rpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_report_configs',
      arguments: {
        ...(className ? { className } : {}),
        limit: 10,
      },
    },
  });
  const sc = call.result?.structuredContent as Record<string, unknown>;
  const configs = (sc?.configs as Array<Record<string, unknown>>) ?? [];
  return configs.map((c) => ({
    id: c.id,
    name: c.name,
    className: c.className,
    reportKind: c.reportKind,
    showInExplorer: c.showInExplorer,
    supported: c.supported,
  }));
}

const ledger = await list('TAccLedgerConfig');
const osb = await list('TAccCirculationListConfig');
const mixed = await list();

console.log(
  JSON.stringify(
    {
      ledgerSample: ledger.slice(0, 5),
      ledgerKinds: [...new Set(ledger.map((c) => c.reportKind))],
      osbSample: osb.slice(0, 5),
      osbKinds: [...new Set(osb.map((c) => c.reportKind))],
      mixedFirstShowFlags: mixed.slice(0, 8).map((c) => c.showInExplorer),
      mixedSortedByExplorer:
        mixed.length <= 1 ||
        mixed.every(
          (c, i, arr) =>
            i === 0 ||
            Number(arr[i - 1]!.showInExplorer) >= Number(c.showInExplorer)
        ),
    },
    null,
    2
  )
);
