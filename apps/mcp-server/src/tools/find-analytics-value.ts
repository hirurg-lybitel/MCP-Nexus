import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';

const inputSchema = z.object({
  fieldName: z
    .string()
    .min(1)
    .describe(
      'USR$ analytics column on AC_ENTRY. Take the name from the account metadata of this database.'
    ),
  query: z
    .string()
    .min(1)
    .describe('Fragment of the value name in the referenced dictionary'),
  limit: z.number().int().min(1).max(100).optional().describe('Max rows (default 20)'),
});

const outputSchema = z.object({
  fieldName: z.string().optional(),
  fieldLabel: z.string().optional(),
  refTable: z.string().optional(),
  values: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        name: z.string(),
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

function isSafeIdent(name: string): boolean {
  return /^[A-Z][A-Z0-9_$]*$/i.test(name);
}

export function registerFindAnalyticsValueTool(server: McpServer): void {
  server.registerTool(
    'find_analytics_value',
    {
      title: 'Find analytics value',
      description:
        'Resolve a value of an AC_ENTRY USR$ analytics field by searching its referenced dictionary table ' +
        '(contract, department, cost item, contact, …). Pass fieldName from account / schema metadata.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const fieldName = args.fieldName.trim().toUpperCase();
      if (!fieldName.startsWith('USR$') || !isSafeIdent(fieldName)) {
        return toolFailure(
          'INVALID_FIELD',
          'fieldName must be a USR$ analytics column identifier'
        );
      }
      const limit = args.limit ?? 20;
      const like = `%${esc(args.query.trim())}%`;

      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();

        const meta = await db.executeSql.run(`
SELECT FIRST 1
  TRIM(arf.fieldname) AS fieldname,
  TRIM(arf.lname) AS lname,
  TRIM(af.reftable) AS reftable
FROM at_relation_fields arf
LEFT JOIN at_fields af ON TRIM(af.fieldname) = TRIM(arf.fieldsource)
WHERE TRIM(arf.relationname) = 'AC_ENTRY'
  AND UPPER(TRIM(arf.fieldname)) = '${esc(fieldName)}'`);

        const metaRow = meta.rows[0] as Record<string, unknown> | undefined;
        const refTable = String(
          metaRow?.REFTABLE ?? metaRow?.reftable ?? ''
        ).trim();
        const fieldLabel = String(metaRow?.LNAME ?? metaRow?.lname ?? fieldName);

        if (!refTable || !isSafeIdent(refTable)) {
          return toolFailure(
            'NO_REFTABLE',
            `No dictionary table for ${fieldName}; check AT_FIELDS.REFTABLE`
          );
        }

        const nameCols = await db.executeSql.run(`
SELECT FIRST 5 TRIM(rf.rdb$field_name) AS fn
FROM rdb$relation_fields rf
WHERE TRIM(rf.rdb$relation_name) = '${esc(refTable.toUpperCase())}'
  AND UPPER(TRIM(rf.rdb$field_name)) IN ('NAME','USR$NAME','CAPTION','NUMBER','ALIAS')
ORDER BY
  CASE UPPER(TRIM(rf.rdb$field_name))
    WHEN 'NAME' THEN 1
    WHEN 'USR$NAME' THEN 2
    WHEN 'CAPTION' THEN 3
    WHEN 'NUMBER' THEN 4
    WHEN 'ALIAS' THEN 5
    ELSE 9
  END`);

        const nameCol = String(
          (nameCols.rows[0] as Record<string, unknown> | undefined)?.FN ??
            (nameCols.rows[0] as Record<string, unknown> | undefined)?.fn ??
            'NAME'
        );
        if (!isSafeIdent(nameCol)) {
          return toolFailure('NO_NAME_COLUMN', `Cannot find name column on ${refTable}`);
        }

        const result = await db.executeSql.run(`
SELECT FIRST ${limit}
  t.id,
  t.${nameCol} AS name
FROM ${refTable} t
WHERE UPPER(t.${nameCol}) LIKE UPPER('${like}')
ORDER BY 2`);

        const values = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.ID ?? r.id,
            name: String(r.NAME ?? r.name ?? ''),
          };
        });

        return toolSuccess({
          fieldName,
          fieldLabel,
          refTable: refTable.toUpperCase(),
          values,
          rowCount: values.length,
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
