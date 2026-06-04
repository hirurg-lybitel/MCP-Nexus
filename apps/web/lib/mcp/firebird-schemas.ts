import { z } from 'zod';

export const tableInfoSchema = z.object({
  tableName: z.string(),
  displayName: z
    .string()
    .nullable()
    .optional()
    .describe('Localized title from AT_RELATIONS (LNAME / LSHORTNAME)'),
  description: z
    .string()
    .nullable()
    .optional()
    .describe('Table description from AT_RELATIONS when available'),
});

export const columnInfoSchema = z.object({
  fieldName: z.string(),
  displayName: z
    .string()
    .nullable()
    .optional()
    .describe('Localized title from AT_RELATION_FIELDS (LNAME / LSHORTNAME)'),
  fieldType: z.string().nullable(),
  fieldLength: z.number().nullable(),
  nullable: z.boolean(),
  position: z.number(),
  constraintType: z
    .enum(['PRIMARY KEY', 'FOREIGN KEY'])
    .nullable()
    .optional()
    .describe('From RDB$RELATION_CONSTRAINTS for this field'),
  refTable: z
    .string()
    .nullable()
    .optional()
    .describe('Referenced table from AT_FIELDS / FK (e.g. GROUPKEY → GD_GOODGROUP)'),
  refListField: z
    .string()
    .nullable()
    .optional()
    .describe('List field on referenced table (often NAME)'),
  refTableDisplayName: z
    .string()
    .nullable()
    .optional()
    .describe('Localized title of referenced table from AT_RELATIONS'),
});

export const searchTablesOutputSchema = {
  query: z.string().describe('Search phrase used'),
  tables: z
    .array(tableInfoSchema)
    .describe('Matching tables from AT_RELATIONS metadata'),
};

export const listTablesOutputSchema = {
  tables: z
    .array(tableInfoSchema)
    .describe('User tables with Gedemin metadata from AT_RELATIONS'),
};

export const describeTableOutputSchema = {
  tableName: z.string().describe('Table name'),
  tableDisplayName: z
    .string()
    .nullable()
    .optional()
    .describe('Localized table title from AT_RELATIONS'),
  columns: z
    .array(columnInfoSchema)
    .describe('Columns merged from RDB$ metadata and AT_RELATION_FIELDS'),
};

export const executeSqlOutputSchema = {
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .describe('Result rows as objects keyed by column name'),
  rowCount: z.number().describe('Number of rows returned (after row limit)'),
  truncated: z
    .boolean()
    .describe('True if more rows existed but were cut by FIREBIRD_MAX_ROWS'),
};

export function firebirdToolSuccess(payload: Record<string, unknown>) {
  const text = JSON.stringify(payload);
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: payload,
  };
}
