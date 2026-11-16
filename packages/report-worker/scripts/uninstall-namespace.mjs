/**
 * Removes MCP.Worker.API handlers installed by install-namespace.mjs.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  MCP_FUNCTION_IDS as IDS,
  MCP_FUNCTION_ID_LIST,
  MCP_FUNCTION_NAMES,
} from './namespace-ids.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const nsDir = resolve(repoRoot, 'packages/report-worker/namespace');

function loadEnv() {
  const env = { ...process.env };
  for (const line of readFileSync(resolve(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const isql = 'D:\\Soft\\Firebird\\Firebird_5_0\\isql.exe';
  const host = env.NODE_FB_HOST || '127.0.0.1';
  const port = env.NODE_FB_PORT || '3055';
  const database = env.NODE_FB_DB;
  if (!database) {
    console.error('NODE_FB_DB missing — refuse to uninstall from an unknown database');
    process.exit(1);
  }
  const db = `${host}/${port}:${database}`;
  const user = env.ISC_USER || 'SYSDBA';
  const password = env.ISC_PASSWORD || 'masterkey';
  const idList = MCP_FUNCTION_ID_LIST.join(', ');
  const nameList = MCP_FUNCTION_NAMES.map((n) => `'${n}'`).join(', ');

  const sql = `
SET NAMES UTF8;
DELETE FROM rp_additionalfunction WHERE mainfunctionkey IN (${idList}) OR addfunctionkey IN (${idList});
DELETE FROM evt_macroslist WHERE functionkey = ${IDS.registerHandlers} OR UPPER(name)='MCP_REGISTERHANDLERS';
DELETE FROM gd_function WHERE id IN (${idList});
DELETE FROM gd_function WHERE UPPER(name) IN (${nameList});
COMMIT;
SELECT COUNT(*) AS remaining FROM gd_function WHERE id IN (${idList}) OR UPPER(name) IN (${nameList});
EXIT;
`;

  const tmpSql = resolve(nsDir, '_uninstall_tmp.sql');
  writeFileSync(tmpSql, sql, 'ascii');
  console.log('uninstall namespace from', db);

  const r = spawnSync(isql, ['-user', user, '-password', password, db, '-i', tmpSql], {
    encoding: 'utf8',
    maxBuffer: 10_000_000,
  });
  console.log(r.stdout || '');
  if (r.stderr) console.error(r.stderr);
  try {
    unlinkSync(tmpSql);
  } catch {
    /* ignore */
  }
  if (r.status !== 0) {
    console.error('isql exit', r.status);
    process.exit(r.status || 1);
  }
  console.log('uninstall done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
