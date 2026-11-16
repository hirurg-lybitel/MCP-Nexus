/**
 * Per-analytics simple saldo SQL mirroring AC_ACCOUNTEXSALDO_BAL
 * (ac_entry_balance + entries after/before CLOSEDATE), returning one row
 * per (analytics value, account, company) instead of collapsing sides.
 *
 * Source: Gedemin SQL/ac_accounting.sql — AC_ACCOUNTEXSALDO_BAL.
 */

export type AnalyticsSaldoSqlParams = {
  fieldName: string;
  accountKeys: number[];
  companyKey: number;
  holdingCompanyKeys: number[];
  dateEnd: string;
  closeDate: string;
};

function escDate(iso: string): string {
  return iso.replace(/'/g, "''");
}

function companyInList(companyKey: number, holdingCompanyKeys: number[]): string {
  const ids = [companyKey, ...holdingCompanyKeys.filter((k) => k !== companyKey)];
  return ids.join(', ');
}

/**
 * Build SELECT: analytics_id, account_key, company_key, simple_ncu
 * using the same balance-cache window as AC_ACCOUNTEXSALDO_BAL.
 */
export function buildAnalyticsSaldoSql(params: AnalyticsSaldoSqlParams): string {
  const field = params.fieldName;
  const accounts = params.accountKeys.join(', ');
  const companies = companyInList(params.companyKey, params.holdingCompanyKeys);
  const dateEnd = escDate(params.dateEnd);
  const closeDate = escDate(params.closeDate);
  const dateEndGeClose = params.dateEnd >= params.closeDate;

  const balancePart = `
SELECT
  bal.${field} AS analytics_id,
  bal.accountkey AS account_key,
  bal.companykey AS company_key,
  bal.debitncu AS debitncu,
  bal.creditncu AS creditncu
FROM ac_entry_balance bal
WHERE bal.accountkey IN (${accounts})
  AND bal.companykey IN (${companies})`;

  const entryPart = dateEndGeClose
    ? `
SELECT
  e.${field} AS analytics_id,
  e.accountkey AS account_key,
  e.companykey AS company_key,
  e.debitncu AS debitncu,
  e.creditncu AS creditncu
FROM ac_entry e
WHERE e.accountkey IN (${accounts})
  AND e.entrydate >= DATE '${closeDate}'
  AND e.entrydate < DATE '${dateEnd}'
  AND e.companykey IN (${companies})`
    : `
SELECT
  e.${field} AS analytics_id,
  e.accountkey AS account_key,
  e.companykey AS company_key,
  -e.debitncu AS debitncu,
  -e.creditncu AS creditncu
FROM ac_entry e
WHERE e.accountkey IN (${accounts})
  AND e.entrydate >= DATE '${dateEnd}'
  AND e.entrydate < DATE '${closeDate}'
  AND e.companykey IN (${companies})`;

  return `
SELECT
  main.analytics_id,
  main.account_key,
  main.company_key,
  CAST(SUM(main.debitncu - main.creditncu) AS NUMERIC(18,4)) AS simple_ncu
FROM (
${balancePart}
UNION ALL
${entryPart}
) main
GROUP BY main.analytics_id, main.account_key, main.company_key`;
}

export function buildLastEntryDateSql(params: {
  fieldName: string;
  accountKeys: number[];
  companyKey: number;
  holdingCompanyKeys: number[];
  dateEnd: string;
}): string {
  const field = params.fieldName;
  const accounts = params.accountKeys.join(', ');
  const companies = companyInList(params.companyKey, params.holdingCompanyKeys);
  const dateEnd = escDate(params.dateEnd);
  return `
SELECT
  e.${field} AS analytics_id,
  MAX(e.entrydate) AS last_entry_date
FROM ac_entry e
WHERE e.accountkey IN (${accounts})
  AND e.companykey IN (${companies})
  AND e.entrydate < DATE '${dateEnd}'
GROUP BY e.${field}`;
}

export function buildCloseDateSql(): string {
  return `
SELECT FIRST 1
  CAST(DATE '1858-11-17' + GEN_ID(gd_g_entry_balance_date, 0) AS DATE) AS closedate
FROM ac_account`;
}

export function buildHoldingKeysSql(companyKey: number): string {
  return `
SELECT h.companykey AS companykey
FROM gd_holding h
WHERE h.holdingkey = ${companyKey}`;
}
