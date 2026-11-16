/**
 * 1.6 — SQL examples for Firebird 5 (non-recursive WITH; windows allowed in ad-hoc run_sql).
 */

import { turnoverByAccountSql, withClause, vAccountsCte, vEntriesCte, vEntryPairsCte } from './cte.js';

export interface SqlExample {
  id: string;
  title: string;
  firebird: '2.5+' | '3+';
  sql: string;
}

export function sqlExamples(params: {
  companyKey: number;
  chartRootId: number;
  dateBegin?: string;
  dateEnd?: string;
}): SqlExample[] {
  const { companyKey, chartRootId } = params;
  const dateBegin = params.dateBegin ?? '2022-01-01';
  const dateEnd = params.dateEnd ?? '2022-12-31';

  return [
    {
      id: 'ex-accounts-count',
      title: 'Count A/S accounts under chart root',
      firebird: '2.5+',
      sql: `
${withClause(vAccountsCte({ chartRootId }))}
SELECT COUNT(*) AS cnt FROM v_accounts
`.trim(),
    },
    {
      id: 'ex-turnover-dontinmove',
      title: 'Period turnover by account (DONTINMOVE=1)',
      firebird: '2.5+',
      sql: turnoverByAccountSql(
        { chartRootId },
        { dateBegin, dateEnd },
        { companyKey },
        { excludeInternal: true }
      ),
    },
    {
      id: 'ex-correspondence-issimple',
      title: 'Correspondence pairs via issimple (fixed GraphViz pattern)',
      firebird: '2.5+',
      sql: `
${withClause(
  vEntriesCte({ dateBegin, dateEnd }, { companyKey }, { excludeInternal: true }),
  vEntryPairsCte()
)}
SELECT FIRST 50
  da.alias AS debit_alias,
  ca.alias AS credit_alias,
  SUM(p.amount_ncu) AS amount_ncu
FROM v_entry_pairs p
JOIN ac_account da ON da.id = p.debit_accountkey
JOIN ac_account ca ON ca.id = p.credit_accountkey
GROUP BY da.alias, ca.alias
ORDER BY 3 DESC
`.trim(),
    },
    {
      id: 'ex-osb-proc',
      title: 'Official trial balance procedure',
      firebird: '2.5+',
      sql: `
SELECT alias, name, id,
  ncu_begin_debit, ncu_begin_credit,
  ncu_debit, ncu_credit,
  ncu_end_debit, ncu_end_credit
FROM ac_circulationlist_bal(
  DATE '${dateBegin}',
  DATE '${dateEnd}',
  ${companyKey},
  0,
  ${chartRootId},
  0,
  1
)
ORDER BY 1
`.trim(),
    },
    {
      id: 'ex-docs-with-entries',
      title: 'Documents that have postings in period',
      firebird: '2.5+',
      sql: `
SELECT FIRST 50
  d.id,
  d.documentdate,
  d.number,
  COUNT(e.id) AS entry_sides
FROM gd_document d
JOIN ac_entry e ON e.documentkey = d.id
WHERE d.documentdate BETWEEN DATE '${dateBegin}' AND DATE '${dateEnd}'
  AND d.companykey = ${companyKey}
GROUP BY d.id, d.documentdate, d.number
ORDER BY d.documentdate DESC
`.trim(),
    },
    {
      id: 'ex-internal-tx',
      title: 'Internal transaction entry sides (ISINTERNAL=1)',
      firebird: '2.5+',
      sql: `
SELECT FIRST 50
  e.id, e.entrydate, e.accountkey, e.debitncu, e.creditncu, tr.name
FROM ac_entry e
JOIN ac_transaction tr ON tr.id = e.transactionkey
WHERE COALESCE(tr.isinternal, 0) = 1
  AND e.companykey = ${companyKey}
  AND e.entrydate BETWEEN DATE '${dateBegin}' AND DATE '${dateEnd}'
ORDER BY e.entrydate
`.trim(),
    },
  ];
}
