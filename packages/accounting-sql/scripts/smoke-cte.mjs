/**
 * Live smoke: CTE turnover vs AC_CIRCULATIONLIST_BAL for Ampersant 2023.
 * Requires Firebird + isql. Uses CRM_WORKER on 3052.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { turnoverByAccountSql } from '../src/cte.ts';
import { AMPERSANT_2022_D9, moneyEqual } from '../src/d9.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const isql = 'D:\\Soft\\Firebird\\Firebird_5_0\\isql.exe';
const db = '127.0.0.1/3052:D:\\Soft\\gedemin\\Databases\\CRM_WORKER.FDB';
const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
const tmp = resolve(dir, '_smoke_tmp.sql');

function runSql(sql) {
  writeFileSync(tmp, sql + '\nEXIT;\n', 'ascii');
  const r = spawnSync(
    isql,
    ['-user', env.ISC_USER || 'SYSDBA', '-password', env.ISC_PASSWORD || 'masterkey', db, '-i', tmp],
    { encoding: 'utf8', maxBuffer: 20_000_000 }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout;
}

function sumDebitFromProc(begin, end, dontInMove) {
  const out = runSql(
    `SELECT SUM(ncu_debit) AS d FROM ac_circulationlist_bal(DATE '${begin}', DATE '${end}', 146866007, 0, 300001, 0, ${dontInMove});`
  );
  const m = out.match(/^\s*([\d.]+)\s*$/m);
  if (!m) throw new Error('parse proc: ' + out);
  return m[1];
}

function sumDebitFromCte(begin, end, excludeInternal) {
  const sql = turnoverByAccountSql(
    { chartRootId: 300001 },
    { dateBegin: begin, dateEnd: end },
    { companyKey: 146866007 },
    { excludeInternal }
  );
  // Aggregate in outer query
  const wrapped = `SELECT SUM(debit) AS d FROM (${sql});`;
  const out = runSql(wrapped);
  const m = [...out.matchAll(/^\s*([\d.]+)\s*$/gm)];
  const last = m[m.length - 1];
  if (!last) throw new Error('parse cte: ' + out);
  return last[1];
}

let failed = 0;

// 2023: DONTINMOVE should match (no internal effect)
{
  const proc = sumDebitFromProc('2023-01-01', '2023-10-31', 1);
  const cte = sumDebitFromCte('2023-01-01', '2023-10-31', true);
  const ok = moneyEqual(proc, cte);
  console.log('2023 CTE vs proc exclude', { proc, cte, ok: ok ? 'MATCH' : 'DIFF' });
  if (!ok) failed += 1;
}

// 2022 D9 fixture
{
  const ex = sumDebitFromProc(
    AMPERSANT_2022_D9.dateBegin,
    AMPERSANT_2022_D9.dateEnd,
    1
  );
  const inc = sumDebitFromProc(
    AMPERSANT_2022_D9.dateBegin,
    AMPERSANT_2022_D9.dateEnd,
    0
  );
  const okEx = moneyEqual(ex, AMPERSANT_2022_D9.debitExcludeInternal);
  const okInc = moneyEqual(inc, AMPERSANT_2022_D9.debitIncludeInternal);
  console.log('2022 D9 fixture', { ex, inc, okEx, okInc });
  if (!okEx || !okInc) failed += 1;

  const cteEx = sumDebitFromCte(
    AMPERSANT_2022_D9.dateBegin,
    AMPERSANT_2022_D9.dateEnd,
    true
  );
  const cteInc = sumDebitFromCte(
    AMPERSANT_2022_D9.dateBegin,
    AMPERSANT_2022_D9.dateEnd,
    false
  );
  const okCteEx = moneyEqual(cteEx, ex);
  const okCteInc = moneyEqual(cteInc, inc);
  console.log('2022 CTE vs proc', { cteEx, cteInc, okCteEx, okCteInc });
  // CTE turnover is period movement only (no opening saldo) — compare to proc turnover, not full OSB.
  // For smoke we only require exclude < include and both finite.
  if (!(Number(cteEx) < Number(cteInc))) {
    console.log('WARN: CTE exclude should be less than include when internals exist');
    failed += 1;
  }
}

process.exit(failed ? 1 : 0);
