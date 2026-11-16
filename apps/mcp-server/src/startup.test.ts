import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertStartupEnv, StartupError } from './startup.js';

describe('assertStartupEnv', () => {
  const base = {
    NODE_FB_HOST: 'localhost',
    NODE_FB_PORT: '3055',
    NODE_FB_DB: 'D:\\db\\test.fdb',
    ISC_USER: 'SYSDBA',
    ISC_PASSWORD: 'masterkey',
  };

  it('requires Firebird env for stdio', () => {
    assert.throws(
      () => assertStartupEnv('stdio', {}),
      (err: unknown) =>
        err instanceof StartupError && /Firebird is not configured/.test(err.message)
    );
  });

  it('allows stdio without MCP_API_KEY', () => {
    assert.doesNotThrow(() => assertStartupEnv('stdio', { ...base }));
  });

  it('requires MCP_API_KEY for http', () => {
    assert.throws(
      () => assertStartupEnv('http', { ...base }),
      (err: unknown) =>
        err instanceof StartupError && /MCP_API_KEY/.test(err.message)
    );
  });

  it('allows http when key and Firebird are set', () => {
    assert.doesNotThrow(() =>
      assertStartupEnv('http', { ...base, MCP_API_KEY: 'k' })
    );
  });
});
