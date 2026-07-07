import { GPT_PROXY_URL } from '@/constants';
import {
  checkRateLimit,
  getClientRateLimitKey,
} from '@/lib/mcp/auth';
import { NextResponse } from 'next/server';

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const rateLimitKey = `openai-proxy:${getClientRateLimitKey(request)}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) {
    return NextResponse.json(
      { error: 'OpenAI not configured on server' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const securityKey =
    typeof payload.security_key === 'string' ? payload.security_key.trim() : '';

  if (!securityKey) {
    return NextResponse.json({ error: 'security_key is required' }, { status: 400 });
  }

  const project = process.env.OPENAI_PROJECT_KEY?.trim();
  const { security_key: _securityKey, ...chatParams } = payload;

  const upstream = await fetch(GPT_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...chatParams,
      security_key: securityKey,
      openai_api_key: openaiApiKey,
      ...(project ? { project } : {}),
    }),
    signal: request.signal,
  });

  const contentType = upstream.headers.get('content-type');
  const responseHeaders = new Headers();
  if (contentType) {
    responseHeaders.set('content-type', contentType);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
