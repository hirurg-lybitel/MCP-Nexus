import '../src/load-env.ts';
process.env.NODE_FB_HOST = process.env.NODE_FB_HOST || 'localhost';

const { createMcpHandler } = await import('@modelcontextprotocol/server');
const { createServer } = await import('../src/create-server.ts');

const handler = createMcpHandler(createServer, {
  legacy: 'stateless',
  responseMode: 'json',
});

async function rpc(id: number, method: string, params?: unknown) {
  const res = await handler.fetch(
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
  );
  const body = await res.text();
  const data = body
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean)
    .at(-1);
  return JSON.parse(data ?? body);
}

await rpc(1, 'initialize', {
  protocolVersion: '2025-03-26',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0' },
});

const result = await rpc(2, 'tools/call', {
  name: 'get_trial_balance',
  arguments: {
    companyKey: 146866007,
    dateBegin: '2023-01-01',
    dateEnd: '2023-10-31',
  },
});

const sc = result.result?.structuredContent ?? JSON.parse(result.result?.content?.[0]?.text ?? '{}');
console.log(
  JSON.stringify(
    {
      source: sc.source,
      rowCount: sc.rowCount,
      totals: sc.totals,
      error: result.result?.isError ? result.result : undefined,
      top: result.error,
    },
    null,
    2
  )
);

await handler.close();
process.exit(0);
