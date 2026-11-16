import type { McpServer } from '@modelcontextprotocol/server';
import {
  loadReportWorkerConfig,
  ReportWorkerClient,
  ReportWorkerError,
} from '@mcp-nexus/report-worker';
import * as z from 'zod/v4';
import {
  reportClassForConfig,
  reportKindForClass,
} from '../lib/report-config-kind.js';
import {
  companyKeyParam,
  companyOutputFields,
  isoDateParam,
  appliedFilters,
} from '../lib/report-params.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const listInput = z.object({
  query: z
    .string()
    .optional()
    .describe('Fragment of saved report config name'),
  className: z
    .string()
    .optional()
    .describe(
      'Filter by config class. Mapping: TAccCirculationListConfig / TCirculationListConfig = ОСВ; ' +
        'TAccLedgerConfig = журнал-ордер; TAccCardConfig = карта счёта; TAccReviewConfig = анализ счёта. ' +
        'Do not call ОСВ configs "journal-order" or ledger configs "ОСВ".'
    ),
  limit: z.number().int().min(1).max(200).optional().describe('Max rows (default 50)'),
});

const listOutput = z.object({
  configs: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

const runInput = z.object({
  configId: z
    .number()
    .int()
    .positive()
    .describe('Saved config id from list_report_configs'),
  companyKey: companyKeyParam,
  dateBegin: isoDateParam('Period start override').optional(),
  dateEnd: isoDateParam('Period end override').optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe('Max data rows returned (default 500)'),
});

const runOutput = z.object({
  source: z.string().optional(),
  configId: z.number().optional(),
  configName: z.string().optional(),
  className: z.string().optional(),
  reportKind: z.string().optional(),
  reportClass: z.string().optional(),
  companyKey: z.number().optional(),
  ...companyOutputFields,
  dateBegin: z.string().optional(),
  dateEnd: z.string().optional(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  truncated: z.boolean().optional(),
  appliedFilters: z.record(z.string(), z.unknown()).optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

function esc(literal: string): string {
  return literal.replace(/'/g, "''");
}

export function registerReportConfigTools(server: McpServer): void {
  server.registerTool(
    'list_report_configs',
    {
      title: 'List saved report configs',
      description:
        'List saved Gedemin accounting report configurations from AC_ACCT_CONFIG. ' +
        'Each row includes reportKind in Russian: ОСВ, журнал-ордер, карта счёта, анализ счёта. ' +
        'TAccLedgerConfig = журнал-ордер (NOT ОСВ); TAccCirculationListConfig = ОСВ. ' +
        'Rows with showInExplorer=1 come first. Then call run_report_config with the id and a period.',
      inputSchema: listInput,
      outputSchema: listOutput,
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const q = args.query?.trim();
      const className = args.className?.trim();
      const filters: string[] = [];
      if (q) {
        filters.push(`UPPER(name) LIKE UPPER('%${esc(q)}%')`);
      }
      if (className) {
        filters.push(`UPPER(classname) = UPPER('${esc(className)}')`);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const result = await db.executeSql.run(`
SELECT FIRST ${limit}
  id,
  name,
  classname,
  folder,
  showinexplorer
FROM ac_acct_config
${where}
ORDER BY showinexplorer DESC, name, id`);

        const configs = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          const cn = String(r.CLASSNAME ?? r.classname ?? '');
          const reportClass = reportClassForConfig(cn);
          return {
            id: r.ID ?? r.id,
            name: String(r.NAME ?? r.name ?? ''),
            className: cn,
            reportKind: reportKindForClass(cn),
            reportClass,
            supported: Boolean(reportClass),
            folder: r.FOLDER ?? r.folder ?? null,
            showInExplorer: Number(r.SHOWINEXPLORER ?? r.showinexplorer ?? 0),
          };
        });

        return toolSuccess({ configs, rowCount: configs.length });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );

  server.registerTool(
    'run_report_config',
    {
      title: 'Run saved report config',
      description:
        'Run a saved AC_ACCT_CONFIG through the Gedemin worker (LoadConfig + BuildReport). ' +
        'Pass dateBegin/dateEnd to override the saved period. Supported classes: ' +
        'TAccCardConfig (карта счёта), TAccLedgerConfig (журнал-ордер), ' +
        'TAccCirculationListConfig (ОСВ), TAccReviewConfig (анализ счёта). ' +
        'Omit companyKey when unnamed; when named, use find_counterparty — never invent. ' +
        'Inventory card configs (TInvCardConfig) are not supported yet.',
      inputSchema: runInput,
      outputSchema: runOutput,
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
        const meta = await db.executeSql.run(`
SELECT FIRST 1 id, name, classname
FROM ac_acct_config
WHERE id = ${args.configId}`);
        const row = meta.rows[0] as Record<string, unknown> | undefined;
        if (!row) {
          return toolFailure(
            'CONFIG_NOT_FOUND',
            `No AC_ACCT_CONFIG with id ${args.configId}`
          );
        }
        const className = String(row.CLASSNAME ?? row.classname ?? '');
        const reportClass = reportClassForConfig(className);
        if (!reportClass) {
          return toolFailure(
            'CONFIG_UNSUPPORTED',
            `Config class ${className || '(empty)'} is not supported by run_report_config`
          );
        }

        const config = loadReportWorkerConfig();
        if (!config) {
          return toolFailure(
            'WORKER_NOT_CONFIGURED',
            'GEDEMIN_WORKER_USER / GEDEMIN_WORKER_PASSWORD not set'
          );
        }

        const client = new ReportWorkerClient(config);
        const raw = (await client.runReportConfig({
          configId: args.configId,
          companyKey: company.companyKey,
          dateBegin: args.dateBegin,
          dateEnd: args.dateEnd,
          limit: args.limit ?? 500,
          className,
          configName: String(row.NAME ?? row.name ?? ''),
          reportClass,
        })) as {
          ok?: boolean;
          error?: string;
          message?: string;
          source?: string;
          configId?: number;
          configName?: string;
          className?: string;
          reportClass?: string;
          companyKey?: number;
          dateBegin?: string;
          dateEnd?: string;
          columns?: string[];
          rows?: Array<Record<string, unknown>>;
          rowCount?: number;
          truncated?: boolean;
        };

        if (!raw || raw.ok === false) {
          return toolFailure(
            raw?.error || 'WORKER_REPORT_ERROR',
            raw?.message || raw?.error || 'Worker returned error'
          );
        }

        const resolvedCompanyKey =
          Number(raw.companyKey ?? company.companyKey) || company.companyKey;
        return toolSuccess({
          source: raw.source ?? 'ac_acct_config',
          configId: args.configId,
          configName: String(row.NAME ?? row.name ?? raw.configName ?? ''),
          className,
          reportKind: reportKindForClass(className),
          reportClass,
          companyKey: resolvedCompanyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          dateBegin: raw.dateBegin ?? args.dateBegin,
          dateEnd: raw.dateEnd ?? args.dateEnd,
          columns: raw.columns ?? [],
          rows: raw.rows ?? [],
          rowCount: raw.rowCount ?? raw.rows?.length ?? 0,
          truncated: raw.truncated ?? false,
          appliedFilters: appliedFilters({
            companyKey: resolvedCompanyKey,
            companyName: company.companyName,
            companyScope: company.companyScope,
            dateBegin: raw.dateBegin ?? args.dateBegin,
            dateEnd: raw.dateEnd ?? args.dateEnd,
          }),
        });
      } catch (error) {
        if (error instanceof ReportWorkerError) {
          return toolFailure(error.code, error.message);
        }
        return mapDbError(error);
      }
    }
  );
}
