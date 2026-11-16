import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { resolveAccountKey } from '../lib/account-key.js';
import {
  isSafeIdent,
  resolveAnalyticsFieldForAccounts,
} from '../lib/analytics-field.js';
import {
  buildAnalyticsSaldoSql,
  buildCloseDateSql,
  buildHoldingKeysSql,
  buildLastEntryDateSql,
} from '../lib/analytics-saldo-sql.js';
import { addMoney, formatMoney, subMoney } from '../lib/money.js';
import {
  accountKeyParam,
  allHoldingCompaniesParam,
  appliedFilters,
  companyKeyParam,
  companyOutputFields,
  isoDateParam,
  withSubAccountsParam,
} from '../lib/report-params.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const inputSchema = z.object({
  companyKey: companyKeyParam,
  accountKey: accountKeyParam,
  dateEnd: isoDateParam('Saldo as of this date'),
  fieldName: z
    .string()
    .optional()
    .describe(
      'AC_ENTRY USR$ analytics column. Omit only when the account tree has exactly one field in AC_ACCANALYTICSEXT; otherwise pass fieldName from that list / find_analytics_value. ' +
        'Do not assume USR$GS_CUSTOMER — on suppliers the attached field may differ or be labeled differently.'
    ),
  withSubAccounts: withSubAccountsParam,
  allHoldingCompanies: allHoldingCompaniesParam,
  side: z
    .enum(['debit', 'credit', 'both'])
    .optional()
    .describe(
      'Which expanded side to rank: debit (нам должны / наши авансы), credit (мы должны / полученные авансы), both (default, by abs).'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Max ranked rows returned (default 20). Totals always cover all analytics.'),
});

const rowSchema = z.object({
  analyticsId: z.union([z.number(), z.string(), z.null()]),
  analyticsName: z.string(),
  debitNcu: z.string(),
  creditNcu: z.string(),
  simpleNcu: z.string(),
  lastEntryDate: z.string().nullable(),
});

const outputSchema = z.object({
  source: z.string().optional(),
  companyKey: z.number().optional(),
  ...companyOutputFields,
  accountKey: z.number().optional(),
  accountAlias: z.string().optional(),
  accountName: z.string().optional(),
  dateEnd: z.string().optional(),
  closeDate: z.string().optional(),
  fieldName: z.string().optional(),
  fieldLabel: z.string().optional(),
  refTable: z.string().nullable().optional(),
  withSubAccounts: z.boolean().optional(),
  allHoldingCompanies: z.boolean().optional(),
  side: z.string().optional(),
  limit: z.number().optional(),
  rows: z.array(rowSchema).optional(),
  rowCount: z.number().optional(),
  analyticsCount: z.number().optional(),
  totals: z
    .object({
      debitNcu: z.string(),
      creditNcu: z.string(),
      simpleNcu: z.string(),
    })
    .optional(),
  availableFields: z
    .array(
      z.object({
        fieldName: z.string(),
        fieldLabel: z.string(),
      })
    )
    .optional(),
  appliedFilters: z.record(z.string(), z.unknown()).optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    const upper = key.toUpperCase();
    if (row[upper] !== undefined) return row[upper];
  }
  return undefined;
}

function isoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m?.[1]) return m[1];
  return s || null;
}

/** Same side split as AC_ACCOUNTEXSALDO_BAL after GROUP BY analytics. */
function splitSimple(simple: string): { debitNcu: string; creditNcu: string } {
  if (simple === '0') return { debitNcu: '0', creditNcu: '0' };
  if (simple.startsWith('-')) {
    return { debitNcu: '0', creditNcu: simple.slice(1) || '0' };
  }
  return { debitNcu: simple, creditNcu: '0' };
}

function analyticsKey(rawId: unknown): number | string | null {
  if (rawId == null || String(rawId).trim() === '') return null;
  const n = typeof rawId === 'bigint' ? Number(rawId) : Number(rawId);
  return Number.isFinite(n) ? n : String(rawId);
}

export function registerAnalyticsBalanceTool(server: McpServer): void {
  server.registerTool(
    'get_analytics_balance',
    {
      title: 'Analytics balance (развёртка по аналитике)',
      description:
        'Expanded account saldo on a date grouped by an AC_ENTRY USR$ analytics field, with dictionary names. ' +
        'Algorithm matches AC_ACCOUNTEXSALDO_BAL (ac_entry_balance + entries in the CLOSEDATE window), per analytics value. ' +
        'Use for top debtors/creditors and customer/supplier breakdown — not for director DZ/KZ totals (those are get_balance totals.debitNcu / totals.creditNcu with default fieldName ACCOUNTKEY). ' +
        'Totals here match get_balance with the same fieldName and withSubAccounts; they generally differ from get_balance without fieldName. ' +
        'Omit fieldName only when AC_ACCANALYTICSEXT has exactly one USR$ field on the account tree. ' +
        'side=debit for ДЗ / нам должны / наши авансы; side=credit for КЗ / мы должны / полученные авансы. ' +
        'Resolve accountKey via find_account. Omit companyKey when unnamed. withSubAccounts defaults to true (LB/RB).',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const company = await resolveWorkingCompany(db, args.companyKey);
        if (!company.ok) {
          return toolFailure(company.code, company.message, {
            ...(company.companies ? { companies: company.companies } : {}),
          });
        }
        const account = await resolveAccountKey(db, args.accountKey);
        if (!account.ok) {
          return toolFailure(account.code, account.message);
        }

        const withSubAccounts = args.withSubAccounts ?? true;
        const allHolding = args.allHoldingCompanies ?? false;
        const side = args.side ?? 'both';
        const limit = args.limit ?? 20;

        const accountKeys: number[] = [];
        if (withSubAccounts) {
          const children = await db.executeSql.run(`
SELECT a.id
FROM ac_account a
JOIN ac_account root ON root.id = ${account.accountKey}
WHERE a.lb >= root.lb AND a.rb <= root.rb`);
          for (const row of children.rows) {
            const id = Number(pick(row as Record<string, unknown>, 'id', 'ID'));
            if (Number.isFinite(id)) accountKeys.push(id);
          }
        }
        if (accountKeys.length === 0) {
          accountKeys.push(account.accountKey);
        }

        const fieldResolved = await resolveAnalyticsFieldForAccounts(
          db,
          accountKeys,
          args.fieldName
        );
        if (!fieldResolved.ok) {
          return toolFailure(fieldResolved.code, fieldResolved.message, {
            availableFields: fieldResolved.availableFields,
          });
        }
        const { meta, availableFields } = fieldResolved;
        if (!isSafeIdent(meta.fieldName)) {
          return toolFailure('INVALID_FIELD', 'Unsafe fieldName');
        }

        let holdingCompanyKeys: number[] = [];
        if (allHolding) {
          const holding = await db.executeSql.run(
            buildHoldingKeysSql(company.companyKey)
          );
          for (const row of holding.rows) {
            const id = Number(
              pick(row as Record<string, unknown>, 'companykey', 'COMPANYKEY')
            );
            if (Number.isFinite(id)) holdingCompanyKeys.push(id);
          }
        }

        const closeResult = await db.executeSql.run(buildCloseDateSql());
        const closeRaw = pick(
          (closeResult.rows[0] as Record<string, unknown> | undefined) ?? {},
          'closedate',
          'CLOSEDATE'
        );
        const closeDate = isoDate(closeRaw);
        if (!closeDate) {
          return toolFailure(
            'CLOSEDATE_UNAVAILABLE',
            'Could not read gd_g_entry_balance_date for AC_ENTRY_BALANCE window'
          );
        }

        const sql = buildAnalyticsSaldoSql({
          fieldName: meta.fieldName,
          accountKeys,
          companyKey: company.companyKey,
          holdingCompanyKeys,
          dateEnd: args.dateEnd,
          closeDate,
        });
        const result = await db.executeSql.run(sql);

        type Agg = {
          analyticsId: number | string | null;
          analyticsName: string;
          debitNcu: string;
          creditNcu: string;
          simpleNcu: string;
          lastEntryDate: string | null;
        };

        /** Aggregate expanded sides by analytics (per-account split, then sum). */
        const byAnalytics = new Map<
          string,
          { analyticsId: number | string | null; debitNcu: string; creditNcu: string }
        >();

        for (const row of result.rows) {
          const r = row as Record<string, unknown>;
          const simpleNcu = formatMoney(pick(r, 'simple_ncu', 'SIMPLE_NCU'));
          if (simpleNcu === '0') continue;
          const sides = splitSimple(simpleNcu);
          const analyticsId = analyticsKey(pick(r, 'analytics_id', 'ANALYTICS_ID'));
          const mapKey = analyticsId == null ? '' : String(analyticsId);
          const prev = byAnalytics.get(mapKey) ?? {
            analyticsId,
            debitNcu: '0',
            creditNcu: '0',
          };
          prev.debitNcu = addMoney(prev.debitNcu, sides.debitNcu);
          prev.creditNcu = addMoney(prev.creditNcu, sides.creditNcu);
          byAnalytics.set(mapKey, prev);
        }

        const lastDates = await db.executeSql.run(
          buildLastEntryDateSql({
            fieldName: meta.fieldName,
            accountKeys,
            companyKey: company.companyKey,
            holdingCompanyKeys,
            dateEnd: args.dateEnd,
          })
        );
        const lastById = new Map<string, string | null>();
        for (const row of lastDates.rows) {
          const r = row as Record<string, unknown>;
          const id = analyticsKey(pick(r, 'analytics_id', 'ANALYTICS_ID'));
          lastById.set(
            id == null ? '' : String(id),
            isoDate(pick(r, 'last_entry_date', 'LAST_ENTRY_DATE'))
          );
        }

        const all: Agg[] = [];
        let totalsDebit = '0';
        let totalsCredit = '0';

        for (const [mapKey, prev] of byAnalytics) {
          if (prev.debitNcu === '0' && prev.creditNcu === '0') continue;
          totalsDebit = addMoney(totalsDebit, prev.debitNcu);
          totalsCredit = addMoney(totalsCredit, prev.creditNcu);
          all.push({
            analyticsId: prev.analyticsId,
            analyticsName:
              prev.analyticsId == null ? '(пусто)' : String(prev.analyticsId),
            debitNcu: prev.debitNcu,
            creditNcu: prev.creditNcu,
            simpleNcu: subMoney(prev.debitNcu, prev.creditNcu),
            lastEntryDate: lastById.get(mapKey) ?? null,
          });
        }

        const filtered = all.filter((row) => {
          if (side === 'debit') return row.debitNcu !== '0';
          if (side === 'credit') return row.creditNcu !== '0';
          return true;
        });

        filtered.sort((a, b) => {
          if (side === 'debit') {
            return Number.parseFloat(b.debitNcu) - Number.parseFloat(a.debitNcu);
          }
          if (side === 'credit') {
            return (
              Number.parseFloat(b.creditNcu) - Number.parseFloat(a.creditNcu)
            );
          }
          return (
            Math.abs(Number.parseFloat(b.simpleNcu)) -
            Math.abs(Number.parseFloat(a.simpleNcu))
          );
        });

        const rows = filtered.slice(0, limit);

        if (
          meta.refTable &&
          meta.nameColumn &&
          isSafeIdent(meta.refTable) &&
          isSafeIdent(meta.nameColumn)
        ) {
          const ids = rows
            .map((row) => row.analyticsId)
            .filter((id): id is number => typeof id === 'number' && id > 0);
          if (ids.length > 0) {
            const names = await db.executeSql.run(`
SELECT t.id, CAST(t.${meta.nameColumn} AS VARCHAR(255)) AS name
FROM ${meta.refTable} t
WHERE t.id IN (${ids.join(',')})`);
            const byId = new Map<number, string>();
            for (const row of names.rows) {
              const r = row as Record<string, unknown>;
              const id = Number(pick(r, 'id', 'ID'));
              if (!Number.isFinite(id)) continue;
              byId.set(id, String(pick(r, 'name', 'NAME') ?? '').trim());
            }
            for (const row of rows) {
              if (typeof row.analyticsId !== 'number') continue;
              const name = byId.get(row.analyticsId);
              if (name) row.analyticsName = name;
            }
          }
        }

        const filterMeta = {
          companyKey: company.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          accountKey: account.accountKey,
          dateEnd: args.dateEnd,
          fieldName: meta.fieldName,
          withSubAccounts,
          allHoldingCompanies: allHolding,
          side,
          limit,
        };

        return toolSuccess({
          source: 'ac_accountexsaldo_bal_analytics',
          companyKey: company.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          accountKey: account.accountKey,
          accountAlias: account.alias,
          accountName: account.name,
          dateEnd: args.dateEnd,
          closeDate,
          fieldName: meta.fieldName,
          fieldLabel: meta.fieldLabel,
          refTable: meta.refTable,
          withSubAccounts,
          allHoldingCompanies: allHolding,
          side,
          limit,
          rows,
          rowCount: rows.length,
          analyticsCount: all.length,
          totals: {
            debitNcu: totalsDebit,
            creditNcu: totalsCredit,
            simpleNcu: subMoney(totalsDebit, totalsCredit),
          },
          availableFields,
          appliedFilters: appliedFilters(filterMeta),
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
