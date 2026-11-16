import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function getMcpApiKey(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const key = env.MCP_API_KEY?.trim();
  return key || undefined;
}

/** HTTP always requires a configured API key (local contract for 2.1). */
export function isMcpAuthRequired(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(getMcpApiKey(env));
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

export interface AuthRateLimitOptions {
  /** Failed attempts before lockout. Default 10. */
  maxFailures?: number;
  /** Sliding window for counting failures (ms). Default 60s. */
  windowMs?: number;
  /** Lockout duration after max failures (ms). Default 60s. */
  lockoutMs?: number;
  now?: () => number;
}

interface Bucket {
  failures: number[];
  lockedUntil: number;
}

/** In-memory per-key lockout after repeated auth failures. */
export class AuthFailureLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  private readonly now: () => number;

  constructor(options: AuthRateLimitOptions = {}) {
    this.maxFailures = options.maxFailures ?? 10;
    this.windowMs = options.windowMs ?? 60_000;
    this.lockoutMs = options.lockoutMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  isLocked(key: string): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket) return false;
    if (bucket.lockedUntil > this.now()) return true;
    if (bucket.lockedUntil > 0) {
      bucket.lockedUntil = 0;
      bucket.failures = [];
    }
    return false;
  }

  recordFailure(key: string): void {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { failures: [], lockedUntil: 0 };
      this.buckets.set(key, bucket);
    }
    bucket.failures = bucket.failures.filter((ts) => t - ts < this.windowMs);
    bucket.failures.push(t);
    if (bucket.failures.length >= this.maxFailures) {
      bucket.lockedUntil = t + this.lockoutMs;
      bucket.failures = [];
    }
  }

  recordSuccess(key: string): void {
    this.buckets.delete(key);
  }

  /** Test helper. */
  clear(): void {
    this.buckets.clear();
  }
}

export function loadAuthRateLimitOptions(
  env: NodeJS.ProcessEnv = process.env
): AuthRateLimitOptions {
  const maxFailures = Number.parseInt(env.MCP_AUTH_MAX_FAILURES ?? '10', 10);
  const windowMs = Number.parseInt(env.MCP_AUTH_WINDOW_MS ?? '60000', 10);
  const lockoutMs = Number.parseInt(env.MCP_AUTH_LOCKOUT_MS ?? '60000', 10);
  return {
    maxFailures:
      Number.isFinite(maxFailures) && maxFailures > 0 ? maxFailures : 10,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
    lockoutMs:
      Number.isFinite(lockoutMs) && lockoutMs > 0 ? lockoutMs : 60_000,
  };
}

export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

const defaultLimiter = new AuthFailureLimiter(loadAuthRateLimitOptions());

export function getDefaultAuthLimiter(): AuthFailureLimiter {
  return defaultLimiter;
}

/**
 * Express middleware: bearer / x-api-key against MCP_API_KEY.
 * Failed attempts are rate-limited per client key (IP).
 */
export function requireMcpAuth(
  req: Request,
  res: Response,
  next: NextFunction,
  limiter: AuthFailureLimiter = defaultLimiter
): void {
  const expected = getMcpApiKey();
  if (!expected) {
    res.status(503).json({ error: 'MCP server not configured' });
    return;
  }

  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const clientKey = clientKeyFromRequest(req);
  if (limiter.isLocked(clientKey)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Too many failed auth attempts' });
    return;
  }

  const token = extractToken(req.headers.authorization, req.headers['x-api-key']);
  if (!validateMcpApiKey(token, expected)) {
    limiter.recordFailure(clientKey);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  limiter.recordSuccess(clientKey);
  next();
}
