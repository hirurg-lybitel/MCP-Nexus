import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolSuccess } from '../lib/tool-result.js';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Fragment of document type name'),
  limit: z.number().int().min(1).max(100).optional(),
});

const outputSchema = z.object({
  documentTypes: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        name: z.string(),
        headerTable: z.string().nullable().optional(),
        lineTable: z.string().nullable().optional(),
      })
    )
    .optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

function esc(literal: string): string {
  return literal.replace(/'/g, "''");
}

export function registerFindDocumentTypeTool(server: McpServer): void {
  server.registerTool(
    'find_document_type',
    {
      title: 'Find document type',
      description:
        'Search GD_DOCUMENTTYPE by name. Returns header/line table names from AT_RELATIONS when available.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const limit = args.limit ?? 20;
      const like = `%${esc(args.query.trim())}%`;
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const sql = `
SELECT FIRST ${limit}
  dt.id,
  dt.name,
  hr.relationname AS header_table,
  lr.relationname AS line_table
FROM gd_documenttype dt
LEFT JOIN at_relations hr ON hr.id = dt.headerrelkey
LEFT JOIN at_relations lr ON lr.id = dt.linerelkey
WHERE UPPER(dt.name) LIKE UPPER('${like}')
ORDER BY dt.name`;
        const result = await db.executeSql.run(sql);
        const documentTypes = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.ID ?? r.id,
            name: String(r.NAME ?? r.name ?? ''),
            headerTable:
              r.HEADER_TABLE != null ? String(r.HEADER_TABLE) : null,
            lineTable: r.LINE_TABLE != null ? String(r.LINE_TABLE) : null,
          };
        });
        return toolSuccess({ documentTypes, rowCount: documentTypes.length });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
