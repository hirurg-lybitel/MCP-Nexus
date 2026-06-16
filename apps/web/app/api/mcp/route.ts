import { MCP_PORT } from '@/constants';
import {
  checkRateLimit,
  copyMcpForwardHeaders,
  getClientRateLimitKey,
  validateClientMcpAuth,
} from '@/lib/mcp/auth';
import { NextRequest, NextResponse } from 'next/server';

const MCP_UPSTREAM = `http://127.0.0.1:${process.env.MCP_PORT ?? MCP_PORT}/mcp`;
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

async function proxyMcpRequest(request: NextRequest): Promise<Response> {
  const rateLimitKey = `mcp-bff:${getClientRateLimitKey(request)}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const auth = validateClientMcpAuth(
    request.headers.get('authorization'),
    request.headers.get('x-api-key')
  );

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const headers = new Headers();
  copyMcpForwardHeaders(request.headers, headers);

  if (auth.bearerToken) {
    headers.set('Authorization', `Bearer ${auth.bearerToken}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    signal: request.signal,
  };

  if (request.method === 'POST' || request.method === 'DELETE') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(MCP_UPSTREAM, init);
  const responseHeaders = new Headers();
  const sessionId = upstream.headers.get('mcp-session-id');
  const contentType = upstream.headers.get('content-type');

  if (sessionId) {
    responseHeaders.set('mcp-session-id', sessionId);
  }
  if (contentType) {
    responseHeaders.set('content-type', contentType);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, { status: 200 });
}
