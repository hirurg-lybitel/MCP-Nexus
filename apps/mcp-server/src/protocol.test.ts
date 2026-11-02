import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import './load-env.js';

async function readJsonRpc(res: Response): Promise<Record<string, unknown>> {
  const ctype = res.headers.get('content-type') ?? '';
  const body = await res.text();
  if (ctype.includes('application/json')) {
    return JSON.parse(body) as Record<string, unknown>;
  }
  // SSE: take the last `data:` line
  const dataLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  assert.ok(dataLines.length > 0, `no SSE data in response: ${body.slice(0, 200)}`);
  return JSON.parse(dataLines[dataLines.length - 1]!) as Record<string, unknown>;
}

/**
 * Protocol-level check (D19): tools/list over the in-process HTTP handler.
 * Full stdio vs HTTP byte-compare comes with accounting tools; here we prove
 * the SDK v2 handler boots, returns instructions, and lists tools.
 */
describe('mcp-server protocol smoke', () => {
  let close: (() => Promise<void>) | undefined;
  let fetchHandler: ((req: Request) => Promise<Response>) | undefined;

  before(async () => {
    const { createMcpHandler } = await import('@modelcontextprotocol/server');
    const { createServer } = await import('./create-server.js');
    const handler = createMcpHandler(createServer, {
      legacy: 'stateless',
      responseMode: 'json',
    });
    fetchHandler = (req) => handler.fetch(req);
    close = () => handler.close();
  });

  after(async () => {
    await close?.();
  });

  it('lists run_sql and get_trial_balance over legacy initialize + tools/list', async () => {
    assert.ok(fetchHandler);

    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };

    const initRes = await fetchHandler!(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'protocol-test', version: '0.0.1' },
          },
        }),
      })
    );
    assert.equal(initRes.status, 200);
    const initJson = await readJsonRpc(initRes);
    const result = initJson.result as {
      serverInfo?: { name?: string };
      instructions?: string;
    };
    assert.equal(result?.serverInfo?.name, 'mcp-nexus');
    assert.match(String(result?.instructions ?? ''), /Гедымин|Gedemin|read/i);

    const listRes = await fetchHandler!(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }),
      })
    );
    assert.equal(listRes.status, 200);
    const listJson = await readJsonRpc(listRes);
    const tools = (listJson.result as { tools?: Array<{ name: string }> })?.tools ?? [];
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['get_trial_balance', 'run_sql']);
  });
});
