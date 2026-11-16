/**
 * Compare get_analytics_balance algorithm (SQL builder) to AC_ACCOUNTEXSALDO_BAL
 * for the same fieldName on 60.1 / 60.5 / 60 tree.
 */
import './../src/load-env.js';
import { requireDbServices } from '@mcp-nexus/db-firebird';
import {
  buildAnalyticsSaldoSql,
  buildCloseDateSql,
} from '../src/lib/analytics-saldo-sql.js';
import { addMoney, formatMoney } from '../src/lib/money.js';

const db = requireDbServices();
const companyKey = 148284864;
const dateEnd = '2025-12-31';
const field = 'USR$GS_CUSTOMER';

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    const u = key.toUpperCase();
    if (row[u] !== undefined) return row[u];
  }
  return undefined;
}

function split(simple: string): { d: string; c: string } {
  if (simple === '0') return { d: '0', c: '0' };
  if (simple.startsWith('-')) return { d: '0', c: simple.slice(1) || '0' };
  return { d: simple, c: '0' };
}

async function closeDate(): Promise<string> {
  const r = await db.executeSql.run(buildCloseDateSql());
  const raw = pick((r.rows[0] as Record<string, unknown>) ?? {}, 'closedate');
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

async function procTotals(accountKey: number): Promise<{ d: string; c: string }> {
  const r = await db.executeSql.run(`
SELECT
  CAST(debitsaldo AS NUMERIC(18,4)) AS debit_ncu,
  CAST(creditsaldo AS NUMERIC(18,4)) AS credit_ncu
FROM ac_accountexsaldo_bal(
  DATE '${dateEnd}',
  ${accountKey},
  '${field}',
  ${companyKey},
  0,
  0
)`);
  const row = (r.rows[0] as Record<string, unknown>) ?? {};
  return {
    d: formatMoney(pick(row, 'debit_ncu')),
    c: formatMoney(pick(row, 'credit_ncu')),
  };
}

async function sqlTotals(accountKeys: number[]): Promise<{ d: string; c: string }> {
  const cd = await closeDate();
  const sql = buildAnalyticsSaldoSql({
    fieldName: field,
    accountKeys,
    companyKey,
    holdingCompanyKeys: [],
    dateEnd,
    closeDate: cd,
  });
  const r = await db.executeSql.run(sql);
  let d = '0';
  let c = '0';
  for (const row of r.rows) {
    const simple = formatMoney(pick(row as Record<string, unknown>, 'simple_ncu'));
    if (simple === '0') continue;
    const s = split(simple);
    d = addMoney(d, s.d);
    c = addMoney(c, s.c);
  }
  return { d, c };
}

const cd = await closeDate();
const a601 = 148542117;
const a605 = 163721982;
const t601p = await procTotals(a601);
const t601s = await sqlTotals([a601]);
const t605p = await procTotals(a605);
const t605s = await sqlTotals([a605]);
const tree = await db.executeSql.run(`
SELECT a.id FROM ac_account a
JOIN ac_account root ON root.id = 366000
WHERE a.lb >= root.lb AND a.rb <= root.rb`);
const keys = tree.rows.map((row) =>
  Number(pick(row as Record<string, unknown>, 'id', 'ID'))
);
let treeProcD = '0';
let treeProcC = '0';
for (const id of keys) {
  const t = await procTotals(id);
  treeProcD = addMoney(treeProcD, t.d);
  treeProcC = addMoney(treeProcC, t.c);
}
const treeSql = await sqlTotals(keys);

console.log(
  JSON.stringify(
    {
      closeDate: cd,
      '60.1': { proc: t601p, sql: t601s, match: t601p.d === t601s.d && t601p.c === t601s.c },
      '60.5': { proc: t605p, sql: t605s, match: t605p.d === t605s.d && t605p.c === t605s.c },
      '60_tree': {
        proc: { d: treeProcD, c: treeProcC },
        sql: treeSql,
        match: treeProcD === treeSql.d && treeProcC === treeSql.c,
      },
    },
    null,
    2
  )
);
