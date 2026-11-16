import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import {
  AuthFailureLimiter,
  requireMcpAuth,
  validateMcpApiKey,
} from './auth.js';

describe('validateMcpApiKey', () => {
  it('accepts equal tokens', () => {
    assert.equal(validateMcpApiKey('secret-key', 'secret-key'), true);
  });

  it('rejects missing or different tokens', () => {
    assert.equal(validateMcpApiKey(undefined, 'secret-key'), false);
    assert.equal(validateMcpApiKey('wrong', 'secret-key'), false);
    assert.equal(validateMcpApiKey('secret-ke', 'secret-key'), false);
  });
});

describe('AuthFailureLimiter', () => {
  it('locks after maxFailures within the window', () => {
    let now = 1_000;
    const limiter = new AuthFailureLimiter({
      maxFailures: 3,
      windowMs: 10_000,
      lockoutMs: 30_000,
      now: () => now,
    });

    assert.equal(limiter.isLocked('1.1.1.1'), false);
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');
    assert.equal(limiter.isLocked('1.1.1.1'), false);
    limiter.recordFailure('1.1.1.1');
    assert.equal(limiter.isLocked('1.1.1.1'), true);

    now += 29_000;
    assert.equal(limiter.isLocked('1.1.1.1'), true);
    now += 2_000;
    assert.equal(limiter.isLocked('1.1.1.1'), false);
  });

  it('recordSuccess clears the bucket', () => {
    const limiter = new AuthFailureLimiter({ maxFailures: 2, lockoutMs: 60_000 });
    limiter.recordFailure('a');
    limiter.recordSuccess('a');
    limiter.recordFailure('a');
    assert.equal(limiter.isLocked('a'), false);
  });
});

describe('requireMcpAuth middleware', () => {
  function mockReq(overrides: Partial<Request> = {}): Request {
    return {
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    } as unknown as Request;
  }

  function mockRes() {
    const state: {
      statusCode: number;
      body: unknown;
      headers: Record<string, string>;
    } = { statusCode: 200, body: undefined, headers: {} };
    const res = {
      status(code: number) {
        state.statusCode = code;
        return res;
      },
      json(body: unknown) {
        state.body = body;
        return res;
      },
      setHeader(name: string, value: string) {
        state.headers[name] = value;
      },
    };
    return { res: res as unknown as Response, state };
  }

  it('returns 401 then 429 after repeated failures', () => {
    const prev = process.env.MCP_API_KEY;
    process.env.MCP_API_KEY = 'test-secret';
    try {
      const limiter = new AuthFailureLimiter({
        maxFailures: 2,
        windowMs: 60_000,
        lockoutMs: 60_000,
      });
      let nextCount = 0;
      const next: NextFunction = () => {
        nextCount += 1;
      };

      const bad = mockReq({
        headers: { authorization: 'Bearer wrong' },
      });

      {
        const { res, state } = mockRes();
        requireMcpAuth(bad, res, next, limiter);
        assert.equal(state.statusCode, 401);
      }
      {
        const { res, state } = mockRes();
        requireMcpAuth(bad, res, next, limiter);
        assert.equal(state.statusCode, 401);
      }
      {
        const { res, state } = mockRes();
        requireMcpAuth(bad, res, next, limiter);
        assert.equal(state.statusCode, 429);
        assert.equal(state.headers['Retry-After'], '60');
      }
      assert.equal(nextCount, 0);

      const good = mockReq({
        headers: { authorization: 'Bearer test-secret' },
      });
      // still locked
      {
        const { res, state } = mockRes();
        requireMcpAuth(good, res, next, limiter);
        assert.equal(state.statusCode, 429);
      }
    } finally {
      if (prev === undefined) delete process.env.MCP_API_KEY;
      else process.env.MCP_API_KEY = prev;
    }
  });

  it('accepts a valid bearer and clears failures', () => {
    const prev = process.env.MCP_API_KEY;
    process.env.MCP_API_KEY = 'test-secret';
    try {
      const limiter = new AuthFailureLimiter({ maxFailures: 5 });
      let nextCount = 0;
      const next: NextFunction = () => {
        nextCount += 1;
      };

      const { res, state } = mockRes();
      requireMcpAuth(
        mockReq({ headers: { authorization: 'Bearer test-secret' } }),
        res,
        next,
        limiter
      );
      assert.equal(state.statusCode, 200);
      assert.equal(nextCount, 1);
    } finally {
      if (prev === undefined) delete process.env.MCP_API_KEY;
      else process.env.MCP_API_KEY = prev;
    }
  });
});
