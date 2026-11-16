import { MCP_UPSTREAM_URL } from '@/constants';
import {
  getMcpApiKey,
  isMcpClientAuthRequired,
  validateClientMcpAuth,
} from '@/lib/mcp/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Fetch MCP server `instructions` via initialize against the v2 upstream.
 * Used when the browser SDK client does not expose getInstructions().
 */
export async function GET(request: NextRequest) {
  const auth = validateClientMcpAuth(
    request.headers.get('authorization'),
    request.headers.get('x-api-key')
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  const bearer =
    auth.bearerToken ||
    (isMcpClientAuthRequired() ? getMcpApiKey() : undefined);
  if (bearer) {
    headers.authorization = `Bearer ${bearer}`;
  }

  try {
    const res = await fetch(MCP_UPSTREAM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'web-instructions', version: '0.0.1' },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const ctype = res.headers.get('content-type') ?? '';
    const raw = await res.text();
    let json: Record<string, unknown>;
    if (ctype.includes('application/json')) {
      json = JSON.parse(raw) as Record<string, unknown>;
    } else {
      const dataLines = raw
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);
      json = JSON.parse(dataLines.at(-1) ?? '{}') as Record<string, unknown>;
    }
    const result = json.result as { instructions?: string } | undefined;
    const instructions =
      typeof result?.instructions === 'string' ? result.instructions : '';
    return NextResponse.json({
      ok: true,
      instructions,
      upstream: MCP_UPSTREAM_URL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message, upstream: MCP_UPSTREAM_URL },
      { status: 502 }
    );
  }
}
