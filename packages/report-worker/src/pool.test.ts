import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWorkerUrls } from './config.js';
import { ReportWorkerError } from './errors.js';
import { WorkerPool } from './pool.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('resolveWorkerUrls', () => {
  it('parses GEDEMIN_WORKER_URLS', () => {
    assert.deepEqual(
      resolveWorkerUrls({
        GEDEMIN_WORKER_URLS:
          'http://127.0.0.1:9080, http://127.0.0.1:9081',
      }),
      ['http://127.0.0.1:9080', 'http://127.0.0.1:9081']
    );
  });

  it('builds from pool size and base port', () => {
    assert.deepEqual(
      resolveWorkerUrls({
        GEDEMIN_WORKER_POOL_SIZE: '3',
        GEDEMIN_WORKER_BASE_PORT: '9080',
        GEDEMIN_WORKER_HOST: '127.0.0.1',
      }),
      [
        'http://127.0.0.1:9080',
        'http://127.0.0.1:9081',
        'http://127.0.0.1:9082',
      ]
    );
  });
});

describe('WorkerPool', () => {
  it('runs two requests on two slots in parallel', async () => {
    const seen = new Set<string>();
    let concurrent = 0;
    let maxConcurrent = 0;

    const pool = new WorkerPool({
      urls: ['http://127.0.0.1:9080', 'http://127.0.0.1:9081'],
      token: 't',
      requestTimeoutMs: 5_000,
      queueTimeoutMs: 5_000,
      fetchImpl: async (input) => {
        const url = String(input);
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        seen.add(url.includes(':9080') ? '9080' : '9081');
        await new Promise((r) => setTimeout(r, 50));
        concurrent -= 1;
        return jsonResponse({ ok: true, rows: [{ n: 1 }], rowCount: 1 });
      },
    });

    await Promise.all([
      pool.request('/mcp/trial_balance', { companyKey: '1' }),
      pool.request('/mcp/trial_balance', { companyKey: '2' }),
    ]);

    assert.equal(maxConcurrent, 2);
    assert.deepEqual([...seen].sort(), ['9080', '9081']);
  });

  it('queues when all slots busy and times out', async () => {
    const pool = new WorkerPool({
      urls: ['http://127.0.0.1:9080'],
      token: 't',
      requestTimeoutMs: 5_000,
      queueTimeoutMs: 80,
      fetchImpl: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return jsonResponse({ ok: true, rows: [] });
      },
    });

    const first = pool.request('/mcp/x', {});
    await new Promise((r) => setTimeout(r, 10));
    await assert.rejects(
      () => pool.request('/mcp/y', {}),
      (err: unknown) =>
        err instanceof ReportWorkerError && err.code === 'WORKER_QUEUE_TIMEOUT'
    );
    await first;
  });

  it('calls onHung and marks unhealthy on request timeout', async () => {
    const hung: number[] = [];
    const pool = new WorkerPool({
      urls: ['http://127.0.0.1:9080'],
      token: 't',
      requestTimeoutMs: 30,
      queueTimeoutMs: 1_000,
      unhealthyMs: 60_000,
      onHung: async (slot) => {
        hung.push(slot.id);
      },
      fetchImpl: async (_input, init) => {
        await new Promise((resolve, reject) => {
          const t = setTimeout(() => resolve(undefined), 500);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
        return jsonResponse({ ok: true });
      },
    });

    await assert.rejects(
      () => pool.request('/mcp/x', {}),
      (err: unknown) =>
        err instanceof ReportWorkerError && err.code === 'WORKER_TIMEOUT'
    );
    assert.deepEqual(hung, [0]);
    assert.ok((pool.getSlots()[0]?.unhealthyUntil ?? 0) > Date.now());
  });
});
