/**
 * CTE fragments for Gedemin accounting views (target: Firebird 5; non-recursive WITH).
 * Non-recursive WITH only (D5 dialect guard).
 */

export interface ChartScope {
  /** Root account id of the company chart (AC_COMPANYACCOUNT.ACCOUNTKEY). */
  chartRootId: number;
}

export interface PeriodScope {
  dateBegin: string; // YYYY-MM-DD
  dateEnd: string;
}

export interface CompanyScope {
  companyKey: number;
  allHoldingCompanies?: boolean;
}

/** D9: match AC_CIRCULATIONLIST_BAL DONTINMOVE=1 */
export const INTERNAL_ENTRY_PREDICATE = `
  NOT EXISTS (
    SELECT e_m.id
    FROM ac_entry e_m
    JOIN ac_entry e_cm ON e_cm.recordkey = e_m.recordkey
      AND e_cm.accountpart <> e_m.accountpart
      AND e_cm.accountkey = e_m.accountkey
      AND (
        e_m.debitncu = e_cm.creditncu
        OR e_m.creditncu = e_cm.debitncu
        OR e_m.debitcurr = e_cm.creditcurr
        OR e_m.creditcurr = e_cm.debitcurr
      )
    WHERE e_m.id = e.id
  )
  AND COALESCE(tr.isinternal, 0) = 0
`.replace(/\s+/g, ' ').trim();

export function companyPredicate(
  alias: string,
  company: CompanyScope
): string {
  if (company.allHoldingCompanies) {
    return `(${alias}.companykey = ${company.companyKey} OR ${alias}.companykey IN (
      SELECT h.companykey FROM gd_holding h WHERE h.holdingkey = ${company.companyKey}
    ))`;
  }
  return `${alias}.companykey = ${company.companyKey}`;
}

/** Active chart accounts under a company chart root (lb/rb). */
export function vAccountsCte(scope: ChartScope): string {
  return `
v_accounts AS (
  SELECT
    a.id,
    a.alias,
    a.name,
    a.parent,
    a.lb,
    a.rb,
    a.accounttype,
    a.offbalance,
    a.activity
  FROM ac_account a
  JOIN ac_account root ON root.id = ${scope.chartRootId}
  WHERE a.lb >= root.lb
    AND a.rb <= root.rb
    AND a.accounttype IN ('A', 'S')
    AND a.alias <> '00'
)
`.trim();
}

/**
 * Entry sides in a period for a company.
 * When excludeInternal is true, applies D9 (DONTINMOVE=1).
 */
export function vEntriesCte(
  period: PeriodScope,
  company: CompanyScope,
  options: { excludeInternal?: boolean } = {}
): string {
  const exclude = options.excludeInternal !== false;
  const joinTr = exclude
    ? 'JOIN ac_transaction tr ON tr.id = e.transactionkey'
    : '';
  const internal = exclude ? `AND ${INTERNAL_ENTRY_PREDICATE}` : '';
  return `
v_entries AS (
  SELECT
    e.id,
    e.recordkey,
    e.entrydate,
    e.accountkey,
    e.accountpart,
    e.debitncu,
    e.creditncu,
    e.debitcurr,
    e.creditcurr,
    e.debiteq,
    e.crediteq,
    e.currkey,
    e.issimple,
    e.companykey,
    e.transactionkey,
    e.documentkey,
    e.masterdockey
  FROM ac_entry e
  ${joinTr}
  WHERE e.entrydate >= DATE '${period.dateBegin}'
    AND e.entrydate <= DATE '${period.dateEnd}'
    AND ${companyPredicate('e', company)}
    ${internal}
)
`.trim();
}

/** Correspondence pairs using issimple (AC_GETSIMPLEENTRY rule). */
export function vEntryPairsCte(): string {
  return `
v_entry_pairs AS (
  SELECT
    d.id AS debit_entry_id,
    c.id AS credit_entry_id,
    d.recordkey,
    d.entrydate,
    d.accountkey AS debit_accountkey,
    c.accountkey AS credit_accountkey,
    d.companykey,
    d.documentkey,
    d.transactionkey,
    IIF(c.issimple = 0, c.creditncu, d.debitncu) AS amount_ncu,
    IIF(c.issimple = 0, c.creditcurr, d.debitcurr) AS amount_curr,
    IIF(c.issimple = 0, c.crediteq, d.debiteq) AS amount_eq
  FROM v_entries d
  JOIN v_entries c
    ON c.recordkey = d.recordkey
   AND c.accountpart = 'C'
   AND d.accountpart = 'D'
)
`.trim();
}

export function vDocumentsCte(
  period: PeriodScope,
  company: CompanyScope
): string {
  return `
v_documents AS (
  SELECT
    d.id,
    d.documentdate,
    d.number,
    d.documenttypekey,
    d.companykey,
    d.description
  FROM gd_document d
  WHERE d.documentdate >= DATE '${period.dateBegin}'
    AND d.documentdate <= DATE '${period.dateEnd}'
    AND ${companyPredicate('d', company)}
)
`.trim();
}

/** Compose a WITH clause from named CTE bodies (without leading WITH). */
export function withClause(...ctes: string[]): string {
  return `WITH\n${ctes.join(',\n')}`;
}

/** Example: turnover by account alias for a period (sides, NCU). */
export function turnoverByAccountSql(
  chart: ChartScope,
  period: PeriodScope,
  company: CompanyScope,
  options: { excludeInternal?: boolean } = {}
): string {
  return `
${withClause(
  vAccountsCte(chart),
  vEntriesCte(period, company, options)
)}
SELECT
  a.alias,
  a.id AS account_id,
  SUM(e.debitncu) AS debit,
  SUM(e.creditncu) AS credit
FROM v_accounts a
LEFT JOIN v_entries e ON e.accountkey = a.id
GROUP BY a.alias, a.id
HAVING SUM(e.debitncu) <> 0 OR SUM(e.creditncu) <> 0
ORDER BY 1
`.trim();
}

export interface JournalOrderAccountScope {
  accountKey: number;
  /** Include lb/rb descendants of accountKey (default true). */
  withSubAccounts?: boolean;
}

/**
 * Aggregated journal-order lines for one account (and optional subaccounts).
 * Returns one row per (entrydate, alias, corr_alias) with NCU debit/credit.
 */
export function journalOrderSql(
  account: JournalOrderAccountScope,
  period: PeriodScope,
  company: CompanyScope,
  options: { excludeInternal?: boolean } = {}
): string {
  const withSubs = account.withSubAccounts !== false;
  const focusAccounts = `
v_focus_accounts AS (
  SELECT a.id, a.alias
  FROM ac_account a
  JOIN ac_account root ON root.id = ${account.accountKey}
  WHERE ${
    withSubs
      ? 'a.lb >= root.lb AND a.rb <= root.rb'
      : 'a.id = root.id'
  }
)`.trim();

  const lines = `
v_jo_lines AS (
  SELECT
    p.entrydate,
    da.alias AS alias,
    ca.alias AS corr_alias,
    p.amount_ncu AS ncu_debit,
    CAST(0 AS NUMERIC(18,4)) AS ncu_credit
  FROM v_entry_pairs p
  JOIN v_focus_accounts da ON da.id = p.debit_accountkey
  JOIN ac_account ca ON ca.id = p.credit_accountkey
  UNION ALL
  SELECT
    p.entrydate,
    ca.alias AS alias,
    da.alias AS corr_alias,
    CAST(0 AS NUMERIC(18,4)) AS ncu_debit,
    p.amount_ncu AS ncu_credit
  FROM v_entry_pairs p
  JOIN v_focus_accounts ca ON ca.id = p.credit_accountkey
  JOIN ac_account da ON da.id = p.debit_accountkey
)`.trim();

  return `
${withClause(
  focusAccounts,
  vEntriesCte(period, company, options),
  vEntryPairsCte(),
  lines
)}
SELECT
  entrydate,
  alias,
  corr_alias,
  CAST(SUM(ncu_debit) AS NUMERIC(18,4)) AS ncu_debit,
  CAST(SUM(ncu_credit) AS NUMERIC(18,4)) AS ncu_credit
FROM v_jo_lines
GROUP BY entrydate, alias, corr_alias
ORDER BY entrydate, alias, corr_alias
`.trim();
}
