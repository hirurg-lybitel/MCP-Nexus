import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearWorkerBlocked,
  markWorkerBlocked,
  wasWorkerBlockedRecently,
} from './block-state.js';
import { isEmptyOkReport } from './empty-report.js';
import { assertWorkerLoopbackHost } from './lifecycle.js';
import {
  isBlockingWindowTitle,
  WorkerSupervisor,
  type WorkerWindowInfo,
} from './supervisor.js';

describe('supervisor window titles', () => {
  it('detects known blocking dialogs', () => {
    assert.equal(isBlockingWindowTitle('Внимание'), true);
    assert.equal(isBlockingWindowTitle('Open File - Security Warning'), true);
    assert.equal(
      isBlockingWindowTitle('Гедымин - Амперсант ООО - mcp_worker'),
      false
    );
  });
});

describe('loopback host (H03)', () => {
  it('accepts localhost variants only', () => {
    assert.equal(assertWorkerLoopbackHost('127.0.0.1').ok, true);
    assert.equal(assertWorkerLoopbackHost('localhost').ok, true);
    assert.equal(assertWorkerLoopbackHost('0.0.0.0').ok, false);
    assert.equal(assertWorkerLoopbackHost('192.168.1.10').ok, false);
  });
});

describe('empty report after block', () => {
  it('flags empty ok payloads', () => {
    assert.equal(isEmptyOkReport({ ok: true, rows: [] }), true);
    assert.equal(isEmptyOkReport({ ok: true, rowCount: 0 }), true);
    assert.equal(isEmptyOkReport({ ok: true, rows: [{ a: 1 }] }), false);
    assert.equal(isEmptyOkReport({ ok: false, rows: [] }), false);
  });

  it('block window expires', () => {
    clearWorkerBlocked();
    assert.equal(wasWorkerBlockedRecently(1000, 5000), false);
    markWorkerBlocked(4000);
    assert.equal(wasWorkerBlockedRecently(1000, 4500), true);
    assert.equal(wasWorkerBlockedRecently(1000, 5500), false);
  });
});

describe('WorkerSupervisor tick', () => {
  it('dismisses a modal without restart when dismiss works', async () => {
    const events: string[] = [];
    let blocked: WorkerWindowInfo[] = [
      { pid: 42, title: 'Внимание' },
    ];
    const supervisor = new WorkerSupervisor({
      host: '127.0.0.1',
      port: 9080,
      launch: {
        gedeminExe: 'x',
        sn: 'localhost/3055:x',
        user: 'u',
        password: 'p',
      },
      findBlocking: async () => blocked,
      dismiss: async () => {
        blocked = [];
        return true;
      },
      isPortUp: async () => true,
      startProcess: async () => ({ pid: 1 }),
      stopProcess: async () => {},
      onEvent: (e) => events.push(e.type),
    });

    await supervisor.tick();
    assert.deepEqual(events, ['modal_seen', 'modal_dismissed']);
  });

  it('restarts when modal persists', async () => {
    const events: string[] = [];
    let stopped: number[] = [];
    let started = 0;
    const supervisor = new WorkerSupervisor({
      host: '127.0.0.1',
      port: 9080,
      launch: {
        gedeminExe: 'x',
        sn: 'localhost/3055:x',
        user: 'u',
        password: 'p',
      },
      modalDismissAttempts: 1,
      findBlocking: async () => [{ pid: 99, title: 'Error' }],
      dismiss: async () => false,
      isPortUp: async () => started > 0,
      startProcess: async () => {
        started += 1;
        return { pid: 100 + started };
      },
      stopProcess: async (pid) => {
        stopped.push(pid);
      },
      onEvent: (e) => events.push(e.type),
    });

    await supervisor.tick();
    assert.ok(events.includes('modal_restart'));
    assert.ok(events.includes('started'));
    assert.ok(stopped.includes(99));
  });
});
