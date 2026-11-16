import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  companyKeyParam,
  companyOutputFields,
  isoDateParam,
} from '../lib/report-params.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const inputSchema = z.object({
  companyKey: companyKeyParam,
  dateBegin: isoDateParam('Period start'),
  dateEnd: isoDateParam('Period end'),
  documentTypeKey: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const outputSchema = z.object({
  companyKey: z.number().optional(),
  ...companyOutputFields,
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export function registerGetDocumentsTool(server: McpServer): void {
  server.registerTool(
    'get_documents',
    {
      title: 'List documents',
      description:
        'List GD_DOCUMENT rows for a company and period. Optional documentTypeKey filter. ' +
        'Omit companyKey when unnamed; when named, use find_counterparty — never invent. ' +
        'Does not expand entry lines — use get_document for one id.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const typeFilter = args.documentTypeKey
        ? `AND d.documenttypekey = ${args.documentTypeKey}`
        : '';
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const company = await resolveWorkingCompany(db, args.companyKey);
        if (!company.ok) {
          return toolFailure(company.code, company.message, {
            ...(company.companies ? { companies: company.companies } : {}),
          });
        }
        const sql = `
SELECT FIRST ${limit}
  d.id,
  d.documentdate,
  d.number,
  d.documenttypekey,
  d.companykey,
  d.description,
  (SELECT COUNT(*) FROM ac_entry e WHERE e.documentkey = d.id) AS entry_sides
FROM gd_document d
WHERE d.companykey = ${company.companyKey}
  AND d.documentdate >= DATE '${args.dateBegin}'
  AND d.documentdate <= DATE '${args.dateEnd}'
  ${typeFilter}
ORDER BY d.documentdate DESC, d.id DESC`;
        const result = await db.executeSql.run(sql);
        return toolSuccess({
          companyKey: company.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          documents: result.rows,
          rowCount: result.rowCount,
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}

export function registerGetDocumentTool(server: McpServer): void {
  server.registerTool(
    'get_document',
    {
      title: 'Get document',
      description:
        'Fetch one GD_DOCUMENT by id plus its AC_ENTRY sides (account, debit/credit NCU).',
      inputSchema: z.object({
        documentId: z.number().int().positive(),
      }),
      outputSchema: z.object({
        document: z.record(z.string(), z.unknown()).nullable().optional(),
        entries: z.array(z.record(z.string(), z.unknown())).optional(),
        dataCutoff: z.string().nullable().optional(),
        error: z.string().optional(),
        code: z.string().optional(),
      }),
    },
    async ({ documentId }) => {
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const doc = await db.executeSql.run(`
SELECT
  d.id, d.documentdate, d.number, d.documenttypekey, d.companykey, d.description
FROM gd_document d
WHERE d.id = ${documentId}`);
        const entries = await db.executeSql.run(`
SELECT FIRST 500
  e.id, e.entrydate, e.accountkey, a.alias AS account_alias,
  e.accountpart, e.debitncu, e.creditncu, e.issimple, e.recordkey
FROM ac_entry e
LEFT JOIN ac_account a ON a.id = e.accountkey
WHERE e.documentkey = ${documentId}
ORDER BY e.recordkey, e.accountpart, e.id`);
        return toolSuccess({
          document: (doc.rows[0] as Record<string, unknown>) ?? null,
          entries: entries.rows,
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
