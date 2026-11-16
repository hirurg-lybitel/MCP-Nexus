import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  appendAuditRecord,
  extractOkAndCode,
  extractRowCount,
  extractSql,
  redactArgs,
  resolveAuditLogPath,
  resolveAuditUser,
  setAuditTransport,
  withAudit,
  type AuditRecord,
} from './audit.js';

describe('audit helpers', () => {
  it('redacts secret-looking keys', () => {
    assert.deepEqual(
      redactArgs({
        sql: 'select 1',
        password: 'secret',
        token: 'abc',
        nested: { apiKey: 'x', companyKey: 1 },
      }),
      {
        sql: 'select 1',
        password: '[redacted]',
        token: '[redacted]',
        nested: { apiKey: '[redacted]', companyKey: 1 },
      }
    );
  });

  it('extracts sql only for run_sql', () => {
    assert.equal(extractSql('run_sql', { sql: 'select 1' }), 'select 1');
    assert.equal(extractSql('find_account', { sql: 'select 1' }), null);
  });

  it('extracts rowCount from structuredContent', () => {
    assert.equal(
      extractRowCount({ structuredContent: { rowCount: 3 } }),
      3
    );
    assert.equal(
      extractRowCount({ structuredContent: { rows: [{}, {}] } }),
      2
    );
    assert.equal(extractRowCount({ structuredContent: {} }), null);
  });

  it('detects tool errors', () => {
    assert.deepEqual(
      extractOkAndCode({
        isError: true,
        structuredContent: { code: 'READ_ONLY_SQL', error: 'no' },
      }),
      { ok: false, errorCode: 'READ_ONLY_SQL' }
    );
    assert.deepEqual(extractOkAndCode({ structuredContent: { rowCount: 1 } }), {
      ok: true,
      errorCode: null,
    });
  });

  it('resolves user and default log path', () => {
    assert.equal(
      resolveAuditUser({ GEDEMIN_WORKER_USER: 'mcp_worker' }),
      'mcp_worker'
    );
    assert.equal(resolveAuditUser({ ISC_USER: 'SYSDBA' }), 'SYSDBA');
    assert.equal(resolveAuditUser({}), 'local');
    assert.match(
      resolveAuditLogPath({}, 'D:\\work'),
      /logs[/\\]mcp-audit\.jsonl$/
    );
  });
});

describe('withAudit + appendAuditRecord', () => {
  const dirs: string[] = [];
  after(async () => {
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes one JSONL line per call', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-audit-'));
    dirs.push(dir);
    const logPath = join(dir, 'audit.jsonl');
    setAuditTransport('http');

    const handler = withAudit(
      'run_sql',
      async (args: { sql: string; password: string }) => ({
        structuredContent: { rowCount: 1, rows: [{ n: 1 }] },
        content: [{ type: 'text', text: '{}' }],
      }),
      {
        logPath,
        env: {
          MCP_AUDIT: '1',
          GEDEMIN_WORKER_USER: 'auditor',
        },
      }
    );

    await handler({ sql: 'select 1 from rdb$database', password: 'nope' });

    const text = await readFile(logPath, 'utf8');
    const record = JSON.parse(text.trim()) as AuditRecord;
    assert.equal(record.tool, 'run_sql');
    assert.equal(record.user, 'auditor');
    assert.equal(record.transport, 'http');
    assert.equal(record.ok, true);
    assert.equal(record.rowCount, 1);
    assert.equal(record.sql, 'select 1 from rdb$database');
    assert.equal((record.args as { password: string }).password, '[redacted]');
    assert.equal(typeof record.durationMs, 'number');
  });

  it('records failures without throwing from the logger', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-audit-'));
    dirs.push(dir);
    const logPath = join(dir, 'fail.jsonl');

    const handler = withAudit(
      'find_account',
      async (_args: { query: string }) => ({
        isError: true as const,
        structuredContent: { error: 'boom', code: 'QUERY_ERROR' },
        content: [{ type: 'text', text: '{}' }],
      }),
      { logPath, env: { MCP_AUDIT: '1', ISC_USER: 'SYSDBA' } }
    );

    const result = await handler({ query: '62' });
    assert.equal((result as { isError?: boolean }).isError, true);

    const record = JSON.parse(
      (await readFile(logPath, 'utf8')).trim()
    ) as AuditRecord;
    assert.equal(record.ok, false);
    assert.equal(record.errorCode, 'QUERY_ERROR');
    assert.equal(record.sql, null);
  });

  it('appendAuditRecord can be disabled', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-audit-'));
    dirs.push(dir);
    const logPath = join(dir, 'off.jsonl');
    await appendAuditRecord(
      {
        ts: new Date().toISOString(),
        durationMs: 1,
        transport: 'stdio',
        user: 'local',
        tool: 'x',
        args: {},
        sql: null,
        rowCount: null,
        ok: true,
        errorCode: null,
      },
      { logPath, env: { MCP_AUDIT: '0' } }
    );
    await assert.rejects(() => readFile(logPath, 'utf8'));
  });
});
