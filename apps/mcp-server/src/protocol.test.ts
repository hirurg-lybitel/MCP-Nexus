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

const PROTOCOL_VERSIONS = ['2025-03-26', '2025-11-25', '2024-11-05'] as const;

/**
 * Protocol-level check (D19): same tool list for supported protocol versions
 * over the in-process HTTP handler (legacy stateless).
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

  async function initialize(protocolVersion: string) {
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
            protocolVersion,
            capabilities: {},
            clientInfo: { name: 'protocol-test', version: '0.0.1' },
          },
        }),
      })
    );
    assert.equal(initRes.status, 200);
    return readJsonRpc(initRes);
  }

  async function listTools() {
    assert.ok(fetchHandler);
    const listRes = await fetchHandler!(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }),
      })
    );
    assert.equal(listRes.status, 200);
    const listJson = await readJsonRpc(listRes);
    const tools =
      (listJson.result as { tools?: Array<{ name: string }> })?.tools ?? [];
    return tools.map((t) => t.name).sort();
  }

  for (const protocolVersion of PROTOCOL_VERSIONS) {
    it(`lists the same tools after initialize ${protocolVersion}`, async () => {
      const initJson = await initialize(protocolVersion);
      const result = initJson.result as {
        serverInfo?: { name?: string };
        instructions?: string;
        protocolVersion?: string;
      };
      assert.equal(result?.serverInfo?.name, 'mcp-nexus');
      assert.match(String(result?.instructions ?? ''), /Гедымин|Gedemin|read/i);
      assert.match(String(result?.instructions ?? ''), /AC_ENTRY/);
      assert.match(String(result?.instructions ?? ''), /find_account/);
      assert.match(String(result?.instructions ?? ''), /USR\$GS_CUSTOMER/);
      assert.match(String(result?.instructions ?? ''), /companyKey/);
      assert.match(String(result?.instructions ?? ''), /AMBIGUOUS_COMPANY|не выдумывай/i);
      assert.match(String(result?.instructions ?? ''), /белорус/i);
      assert.match(String(result?.instructions ?? ''), /get_account_analysis|выручк/i);
      assert.ok(result?.protocolVersion);

      const names = await listTools();
      assert.deepEqual(names, [
        'find_account',
        'find_analytics_value',
        'find_counterparty',
        'find_document_type',
        'find_item',
        'get_account_analysis',
        'get_account_card',
        'get_account_saldo',
        'get_analytics_balance',
        'get_balance',
        'get_chart_of_accounts',
        'get_document',
        'get_documents',
        'get_journal_order',
        'get_trial_balance',
        'list_report_configs',
        'run_report_config',
        'run_sql',
      ]);
    });
  }

  it('tools/call get_trial_balance returns structured totals for the connected database', async () => {
    await initialize('2025-03-26');
    assert.ok(fetchHandler);

    const companyRes = await fetchHandler!(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'run_sql',
            arguments: {
              sql: `SELECT FIRST 1 companykey, accountkey
FROM ac_companyaccount
WHERE isactive = 1
ORDER BY companykey`,
            },
          },
        }),
      })
    );
    const companyJson = await readJsonRpc(companyRes);
    const companyResult = companyJson.result as {
      isError?: boolean;
      structuredContent?: { rows?: Array<Record<string, unknown>> };
      content?: Array<{ type: string; text?: string }>;
    };
    let companyPayload = companyResult.structuredContent;
    if (!companyPayload && companyResult.content?.[0]?.text) {
      companyPayload = JSON.parse(companyResult.content[0].text) as typeof companyPayload;
    }
    assert.notEqual(companyResult.isError, true, JSON.stringify(companyPayload));
    const companyRow = companyPayload?.rows?.[0];
    const companyKey = Number(companyRow?.COMPANYKEY ?? companyRow?.companykey);
    assert.ok(companyKey > 0, JSON.stringify(companyPayload));

    const callRes = await fetchHandler!(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'get_trial_balance',
            arguments: {
              companyKey,
              dateBegin: '2023-01-01',
              dateEnd: '2023-01-31',
            },
          },
        }),
      })
    );
    assert.equal(callRes.status, 200);
    const callJson = await readJsonRpc(callRes);
    assert.equal(callJson.error, undefined, JSON.stringify(callJson.error));
    const toolResult = callJson.result as {
      isError?: boolean;
      structuredContent?: {
        source?: string;
        rowCount?: number;
        companyKey?: number;
        accountKey?: number;
        totals?: { debit?: string; credit?: string; account_count?: number };
      };
      content?: Array<{ type: string; text?: string }>;
    };
    assert.ok(toolResult, JSON.stringify(callJson));
    assert.notEqual(toolResult.isError, true, JSON.stringify(toolResult));

    let sc = toolResult.structuredContent;
    if (!sc && toolResult.content?.[0]?.text) {
      sc = JSON.parse(toolResult.content[0].text) as typeof sc;
    }
    assert.ok(sc, JSON.stringify(toolResult));
    assert.equal(sc!.companyKey, companyKey);
    assert.equal(typeof sc!.accountKey, 'number');
    assert.ok(
      sc!.source === 'tgdv_acct_circulation_list' ||
        sc!.source === 'ac_circulationlist_bal',
      `unexpected source ${sc!.source}`
    );
    assert.equal(typeof sc!.rowCount, 'number');
    assert.equal(typeof sc!.totals?.debit, 'string');
    assert.equal(typeof sc!.totals?.credit, 'string');
  });
});
