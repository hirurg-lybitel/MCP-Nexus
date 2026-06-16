/**
 * Integration checks for read-only SQL enforcement (requires Firebird in .env).
 * Run: pnpm test:integration
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import {
  assertReadOnlySql,
  createDbServices,
  disposeDbServices,
  loadFirebirdConfig,
  ReadOnlySqlError,
} from '../src/index.ts';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envFile =
  process.env.FIREBIRD_ENV_FILE ??
  resolve(process.cwd(), '../../apps/web/.env');

loadEnvFile(envFile);

const BLOCKED_QUERIES = [
  'INSERT INTO RDB$DATABASE (X) VALUES (1)',
  'UPDATE RDB$DATABASE SET X = 1',
  'DELETE FROM RDB$DATABASE',
  'EXECUTE BLOCK AS BEGIN END',
  'SELECT GEN_ID(RDB$GENERATORS, 1) FROM RDB$DATABASE',
  'SELECT 1 FROM RDB$DATABASE FOR UPDATE',
];

async function main() {
  console.log('Guard-level blocked queries:');
  for (const sql of BLOCKED_QUERIES) {
    assert.throws(() => assertReadOnlySql(sql), ReadOnlySqlError, sql);
    console.log(`  ok  blocked: ${sql.slice(0, 60)}${sql.length > 60 ? '…' : ''}`);
  }

  const config = loadFirebirdConfig();
  if (!config) {
    console.log(
      'Firebird not configured — skipping DB integration (set NODE_FB_* / ISC_* or FIREBIRD_ENV_FILE).'
    );
    return;
  }

  const db = createDbServices(config);

  try {
    console.log('\nDB-level read-only via executeSql:');
    for (const sql of BLOCKED_QUERIES) {
      await assert.rejects(
        () => db.executeSql.run(sql),
        (err: unknown) => err instanceof ReadOnlySqlError,
        `expected ReadOnlySqlError for: ${sql}`
      );
      console.log(`  ok  rejected: ${sql.slice(0, 60)}${sql.length > 60 ? '…' : ''}`);
    }

    const readResult = await db.executeSql.run(
      'SELECT 1 AS ONE FROM RDB$DATABASE'
    );
    assert.equal(readResult.rowCount, 1);
    assert.deepEqual(readResult.rows[0], { ONE: 1 });
    console.log('  ok  allowed SELECT 1 FROM RDB$DATABASE');

    console.log('\nDB-level read-only via runValidatedQuery (full MCP stack):');
    await assert.rejects(
      () => db.runValidatedQuery.run('INSERT INTO T (ID) VALUES (1)'),
      (err: unknown) => err instanceof ReadOnlySqlError
    );
    console.log('  ok  runValidatedQuery rejects INSERT');

    const tables = await db.listTables.run();
    assert.ok(tables.length > 0, 'need at least one user table for runValidatedQuery smoke');

    const tableName = tables[0]!.tableName;
    const validated = await db.runValidatedQuery.run(
      `SELECT FIRST 1 1 AS ONE FROM ${tableName}`
    );
    assert.equal(validated.rowCount, 1);
    console.log(`  ok  runValidatedQuery allows SELECT on ${tableName}`);

    console.log('\nAll read-only integration checks passed.');
  } finally {
    await disposeDbServices();
  }
}

main().catch((error) => {
  console.error('Read-only integration failed:', error);
  process.exit(1);
});
