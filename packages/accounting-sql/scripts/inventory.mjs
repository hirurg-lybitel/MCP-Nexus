/**
 * 1.5 inventory: transactions and reports usage for the year before data cutoff.
 * Writes docs/specs/001-mcp-server-v2/inventory-snapshot.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const isql = 'D:\\Soft\\Firebird\\Firebird_5_0\\isql.exe';
const db = '127.0.0.1/3052:D:\\Soft\\gedemin\\Databases\\CRM_WORKER.FDB';
const tmp = resolve(dirname(fileURLToPath(import.meta.url)), '_inv_tmp.sql');

function run(sql) {
  writeFileSync(tmp, sql + '\nEXIT;\n', 'ascii');
  const r = spawnSync(
    isql,
    ['-user', env.ISC_USER || 'SYSDBA', '-password', env.ISC_PASSWORD || 'masterkey', db, '-i', tmp],
    { encoding: 'utf8', maxBuffer: 20_000_000 }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout;
}

function parseTable(out) {
  const lines = out.split(/\r?\n/).filter((l) => /^\s*\d/.test(l) || /^\s+[A-Z0-9_]/.test(l));
  return out;
}

const counts = run(`
SELECT 'AC_ENTRY' AS t, COUNT(*) AS c FROM ac_entry
UNION ALL SELECT 'AC_RECORD', COUNT(*) FROM ac_record
UNION ALL SELECT 'GD_DOCUMENT', COUNT(*) FROM gd_document
UNION ALL SELECT 'AC_TRANSACTION', COUNT(*) FROM ac_transaction
UNION ALL SELECT 'AC_ACCOUNT', COUNT(*) FROM ac_account
UNION ALL SELECT 'AC_ACCT_CONFIG', COUNT(*) FROM ac_acct_config
UNION ALL SELECT 'RP_REPORTLIST', COUNT(*) FROM rp_reportlist
UNION ALL SELECT 'GD_FUNCTION', COUNT(*) FROM gd_function
UNION ALL SELECT 'GD_OURCOMPANY', COUNT(*) FROM gd_ourcompany;
`);

const topTx = run(`
SELECT FIRST 15 tr.id, tr.name, COUNT(*) AS cnt
FROM ac_entry e
JOIN ac_transaction tr ON tr.id = e.transactionkey
WHERE e.entrydate BETWEEN DATE '2022-01-01' AND DATE '2022-12-31'
  AND e.companykey = 146866007
GROUP BY tr.id, tr.name
ORDER BY 3 DESC;
`);

const reportFns = run(`
SELECT FIRST 20 f.id, f.name, f.module
FROM gd_function f
WHERE UPPER(f.name) CONTAINING 'ОСВ'
   OR UPPER(f.name) CONTAINING 'CIRCUL'
   OR UPPER(f.name) CONTAINING 'ОБОРОТ'
ORDER BY f.name;
`);

const snapshot = {
  generatedAt: new Date().toISOString(),
  database: 'CRM_WORKER.FDB',
  periodHint: '2022 for transaction stats',
  raw: {
    counts,
    topTx2022Ampersant: topTx,
    reportLikeFunctions: reportFns,
  },
};

const outPath = resolve(root, 'docs/specs/001-mcp-server-v2/inventory-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');
console.log('wrote', outPath);
console.log(counts);
console.log(topTx.slice(0, 1500));
