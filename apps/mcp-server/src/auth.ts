import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function getMcpApiKey(): string | undefined {
  const key = process.env.MCP_API_KEY?.trim();
  return key || undefined;
}

export function isMcpAuthRequired(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(getMcpApiKey());
}

function extractToken(
  authorization: string | undefined,
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

export function validateMcpApiKey(token: string | undefined, expected: string): boolean {
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

/** Express middleware: bearer / x-api-key against MCP_API_KEY. */
export function requireMcpAuth(req: Request, res: Response, next: NextFunction): void {
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

  const token = extractToken(req.headers.authorization, req.headers['x-api-key']);
  if (!validateMcpApiKey(token, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
