import './../src/load-env.js';
import { journalOrderSql } from '@mcp-nexus/accounting-sql';
import { requireDbServices } from '@mcp-nexus/db-firebird';
import { resolveAccountKey } from '../src/lib/account-key.js';
import { loadAccountNameIndex } from '../src/lib/account-names.js';
import { resolveActiveChart } from '../src/lib/active-chart.js';
import { resolveWorkingCompany } from '../src/lib/working-company.js';
import { pivotJournal } from '../src/tools/journal-order.js';

const db = requireDbServices();
const companyKey = 148284864;
const t0 = Date.now();

const company = await resolveWorkingCompany(db, companyKey);
if (!company.ok) throw new Error(company.message);
const account = await resolveAccountKey(db, 355100);
if (!account.ok) throw new Error(account.message);

const sql = journalOrderSql(
  { accountKey: account.accountKey, withSubAccounts: true },
  { dateBegin: '2025-12-01', dateEnd: '2025-12-31' },
  { companyKey: company.companyKey },
  { excludeInternal: true }
);
const result = await db.executeSql.run(sql);
const lines = result.rows.map((raw) => {
  const row = raw as Record<string, unknown>;
  return {
    entryDate: String(row.ENTRYDATE ?? row.entrydate ?? ''),
    alias: String(row.ALIAS ?? row.alias ?? ''),
    corrAlias: String(row.CORR_ALIAS ?? row.corr_alias ?? ''),
    ncuDebit: (row.NCU_DEBIT ?? row.ncu_debit) as number | string | undefined,
    ncuCredit: (row.NCU_CREDIT ?? row.ncu_credit) as number | string | undefined,
  };
});

let nameIndex = { byAlias: new Map<string, string>(), byId: new Map() };
const chart = await resolveActiveChart(db, company.companyKey);
if (chart.ok) nameIndex = await loadAccountNameIndex(db, chart.accountKey);

const rows = pivotJournal(lines, 'ENTRYDATE', nameIndex);
const monthRows = pivotJournal(lines, 'MONTH', nameIndex);
const noneRows = pivotJournal(lines, 'NONE', nameIndex);

const topCorr = (
  monthRows[0]?.correspondence as
    | Array<{ corrAlias: string; ncuDebit: string; ncuCredit: string }>
    | undefined
)
  ?.slice()
  .sort((a, b) => {
    const as = Number(a.ncuDebit) + Number(a.ncuCredit);
    const bs = Number(b.ncuDebit) + Number(b.ncuCredit);
    return bs - as;
  })
  .slice(0, 8);

console.log(
  JSON.stringify(
    {
      ms: Date.now() - t0,
      accountKey: account.accountKey,
      lineCount: lines.length,
      entryDateRows: rows.length,
      monthRows: monthRows.length,
      noneRows: noneRows.length,
      monthDebit: monthRows[0]?.ncuDebit,
      monthCredit: monthRows[0]?.ncuCredit,
      topCorr,
      source: 'ac_entry_issimple_pivot',
    },
    null,
    2
  )
);
