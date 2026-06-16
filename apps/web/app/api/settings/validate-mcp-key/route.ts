import {
  checkRateLimit,
  getClientRateLimitKey,
  getMcpApiKey,
  isMcpAuthRequired,
  validateMcpApiKey,
} from '@/lib/mcp/auth';
import { NextResponse } from 'next/server';

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const rateLimitKey = `validate-mcp-key:${getClientRateLimitKey(request)}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const key =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).key === 'string'
      ? (body as Record<string, string>).key
      : '';

  const expected = getMcpApiKey();

  if (!expected) {
    if (isMcpAuthRequired()) {
      return NextResponse.json(
        { valid: false, error: 'MCP server not configured' },
        { status: 503 }
      );
    }
    return NextResponse.json({
      valid: true,
      authRequired: false,
      message: 'MCP authentication is disabled in development.',
    });
  }

  if (!validateMcpApiKey(key, expected)) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ valid: true, authRequired: true });
}
