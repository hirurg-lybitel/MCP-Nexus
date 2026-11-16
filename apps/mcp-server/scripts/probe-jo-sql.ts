import './../src/load-env.js';
import { writeFileSync } from 'node:fs';
import { requireDbServices } from '@mcp-nexus/db-firebird';

const db = requireDbServices();

const t0 = Date.now();
const result = await db.executeSql.run(`
WITH accounts AS (
  SELECT a.id, a.alias
  FROM ac_account a
  JOIN ac_account root ON root.id = 355100
  WHERE a.lb >= root.lb AND a.rb <= root.rb
),
entries AS (
  SELECT
    e.id,
    e.recordkey,
    e.entrydate,
    e.accountkey,
    e.accountpart,
    e.debitncu,
    e.creditncu,
    e.issimple
  FROM ac_entry e
  WHERE e.entrydate >= DATE '2025-12-01'
    AND e.entrydate <= DATE '2025-12-31'
    AND e.companykey = 148284864
),
pairs AS (
  SELECT
    d.entrydate,
    d.accountkey AS debit_accountkey,
    c.accountkey AS credit_accountkey,
    IIF(c.issimple = 0, c.creditncu, d.debitncu) AS amount_ncu
  FROM entries d
  JOIN entries c
    ON c.recordkey = d.recordkey
   AND c.accountpart = 'C'
   AND d.accountpart = 'D'
),
lines AS (
  SELECT
    p.entrydate,
    da.alias AS alias,
    ca.alias AS corr_alias,
    p.amount_ncu AS ncu_debit,
    CAST(0 AS NUMERIC(18,4)) AS ncu_credit
  FROM pairs p
  JOIN accounts da ON da.id = p.debit_accountkey
  JOIN ac_account ca ON ca.id = p.credit_accountkey
  UNION ALL
  SELECT
    p.entrydate,
    ca.alias AS alias,
    da.alias AS corr_alias,
    CAST(0 AS NUMERIC(18,4)) AS ncu_debit,
    p.amount_ncu AS ncu_credit
  FROM pairs p
  JOIN accounts ca ON ca.id = p.credit_accountkey
  JOIN ac_account da ON da.id = p.debit_accountkey
)
SELECT
  entrydate,
  alias,
  corr_alias,
  CAST(SUM(ncu_debit) AS NUMERIC(18,4)) AS ncu_debit,
  CAST(SUM(ncu_credit) AS NUMERIC(18,4)) AS ncu_credit
FROM lines
GROUP BY entrydate, alias, corr_alias
ORDER BY entrydate, alias, corr_alias
`);

writeFileSync(
  'scripts/probe-jo-sql-out.json',
  JSON.stringify(
    {
      ms: Date.now() - t0,
      rowCount: result.rows.length,
      sample: result.rows.slice(0, 15),
      debitSum: result.rows.reduce(
        (s, r) => s + Number((r as { NCU_DEBIT?: string }).NCU_DEBIT ?? 0),
        0
      ),
      creditSum: result.rows.reduce(
        (s, r) => s + Number((r as { NCU_CREDIT?: string }).NCU_CREDIT ?? 0),
        0
      ),
    },
    null,
    2
  )
);
console.log('ms', Date.now() - t0, 'rows', result.rows.length);
