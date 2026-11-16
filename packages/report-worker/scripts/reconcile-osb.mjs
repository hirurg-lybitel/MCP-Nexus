/**
 * Reconcile trial balance: worker HTTP vs AC_CIRCULATIONLIST_BAL on one or more DBs.
 * Usage: node packages/report-worker/scripts/reconcile-osb.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const cases = [
  { label: '2023-partial', begin: '2023-01-01', end: '2023-10-31' },
  { label: '2022-full', begin: '2022-01-01', end: '2022-12-31' },
];

const dbs = [
  {
    label: 'FB25-CRM_WORKER',
    dsn: '127.0.0.1/3052:D:\\Soft\\gedemin\\Databases\\CRM_WORKER.FDB',
  },
  {
    label: 'FB5-CRM_FB5',
    dsn: '127.0.0.1/3055:D:\\Soft\\gedemin\\Databases\\CRM_FB5.FDB',
  },
];

const companyKey = 146866007;
const accountKey = 300001;
const token = env.GEDEMIN_WORKER_TOKEN || 'mcp-worker-dev';
const host = env.GEDEMIN_WORKER_HOST || '127.0.0.1';
const port = env.GEDEMIN_WORKER_PORT || '9080';
const isql = 'D:\\Soft\\Firebird\\Firebird_5_0\\isql.exe';
const tmpSql = resolve(root, 'packages/report-worker/scripts/_reconcile_tmp.sql');

function procTotals(dsn, begin, end) {
  const sql =
    `SELECT COUNT(*) AS cnt, SUM(ncu_debit) AS debit, SUM(ncu_credit) AS credit ` +
    `FROM ac_circulationlist_bal(DATE '${begin}', DATE '${end}', ${companyKey}, 0, ${accountKey}, 0, 1);\nEXIT;\n`;
  writeFileSync(tmpSql, sql, 'ascii');
  const r = spawnSync(
    isql,
    ['-user', env.ISC_USER || 'SYSDBA', '-password', env.ISC_PASSWORD || 'masterkey', dsn, '-i', tmpSql],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    throw new Error(`isql failed on ${dsn}: ${r.stderr || r.stdout}`);
  }
  const nums = [...(r.stdout || '').matchAll(/^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s*$/gm)];
  const last = nums[nums.length - 1];
  if (!last) throw new Error(`parse isql output failed:\n${r.stdout}`);
  return {
    cnt: Number(last[1]),
    debit: last[2],
    credit: last[3],
  };
}

async function workerTotals(begin, end) {
  const url = new URL(`http://${host}:${port}/mcp/trial_balance`);
  url.searchParams.set('token', token);
  url.searchParams.set('companyKey', String(companyKey));
  url.searchParams.set('dateBegin', begin);
  url.searchParams.set('dateEnd', end);
  url.searchParams.set('accountKey', String(accountKey));
  url.searchParams.set('includeInternal', '0');
  url.searchParams.set('allHoldingCompanies', '0');
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text);
  if (!json.ok) throw new Error(`worker error: ${text.slice(0, 300)}`);
  const debit = (json.rows || []).reduce((s, row) => s + Number(row.ncuDebit || 0), 0);
  const credit = (json.rows || []).reduce((s, row) => s + Number(row.ncuCredit || 0), 0);
  return {
    cnt: (json.rows || []).length,
    debit: debit.toFixed(4),
    credit: credit.toFixed(4),
  };
}

function sameMoney(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.00005;
}

let failed = 0;
for (const c of cases) {
  console.log(`\n=== ${c.label} ${c.begin}..${c.end} ===`);
  const worker = await workerTotals(c.begin, c.end);
  console.log('worker', worker);
  for (const db of dbs) {
    const proc = procTotals(db.dsn, c.begin, c.end);
    const ok =
      proc.cnt === worker.cnt &&
      sameMoney(proc.debit, worker.debit) &&
      sameMoney(proc.credit, worker.credit);
    console.log(db.label, proc, ok ? 'MATCH' : 'DIFF');
    if (!ok) failed += 1;
  }
}

process.exit(failed ? 1 : 0);
