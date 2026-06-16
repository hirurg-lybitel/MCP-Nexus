import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request as ExpressRequest, Response } from 'express';

const MCP_FORWARD_HEADERS = [
  'content-type',
  'accept',
  'mcp-session-id',
  'mcp-protocol-version',
  'last-event-id',
] as const;

export function getMcpApiKey(): string | undefined {
  const key = process.env.MCP_API_KEY?.trim();
  return key || undefined;
}

export function isMcpAuthRequired(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** True when UI/BFF must receive a valid client MCP key (env key is set or production). */
export function isMcpClientAuthRequired(): boolean {
  return Boolean(getMcpApiKey()) || isMcpAuthRequired();
}

export type McpClientAuthResult =
  | { ok: true; bearerToken: string | undefined }
  | { ok: false; status: number; error: string };

export function validateClientMcpAuth(
  authorization: string | null | undefined,
  apiKeyHeader: string | null | undefined
): McpClientAuthResult {
  const expected = getMcpApiKey();

  if (!expected) {
    if (isMcpAuthRequired()) {
      return { ok: false, status: 503, error: 'MCP server not configured' };
    }
    return { ok: true, bearerToken: undefined };
  }

  const token = extractMcpAuthToken(
    authorization ?? undefined,
    apiKeyHeader ?? undefined
  );

  if (!validateMcpApiKey(token, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true, bearerToken: token };
}

export function extractMcpAuthToken(
  authorization: string | null | undefined,
  apiKeyHeader: string | string[] | undefined
): string | undefined {
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7);
  }
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }
  if (Array.isArray(apiKeyHeader)) {
    return apiKeyHeader[0];
  }
  return undefined;
}

export function validateMcpApiKey(
  token: string | undefined,
  expected: string
): boolean {
  if (!token) {
    return false;
  }
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export function requireMcpAuth(
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): void {
  const expected = getMcpApiKey();

  if (!expected) {
    if (isMcpAuthRequired()) {
      res.status(503).json({ error: 'MCP server not configured' });
      return;
    }
    next();
    return;
  }

  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const token = extractMcpAuthToken(
    req.headers.authorization,
    req.headers['x-api-key']
  );

  if (!validateMcpApiKey(token, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function mcpAuthHeaders(): Record<string, string> {
  const key = getMcpApiKey();
  if (!key) {
    return {};
  }
  return { Authorization: `Bearer ${key}` };
}

export function copyMcpForwardHeaders(
  source: Headers,
  target: Headers
): void {
  for (const name of MCP_FORWARD_HEADERS) {
    const value = source.get(name);
    if (value) {
      target.set(name, value);
    }
  }
}

export function isSameOriginRequest(request: globalThis.Request): boolean {
  const host = request.headers.get('host');
  if (!host) {
    return false;
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function getClientRateLimitKey(request: globalThis.Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'local';
}
