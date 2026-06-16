import { SensitiveColumnError } from '../domain/errors';
import type { ITableSchemaRegistry } from '../ports/ITableSchemaRegistry';
import { extractTableNamesFromSql } from './sql-table-names';

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');
}

/** True when the SELECT list uses * or alias.* (not column-specific). */
export function hasWildcardSelect(sql: string): boolean {
  const cleaned = stripSqlComments(sql);
  const match = cleaned.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
  if (!match) {
    return false;
  }

  const selectList = (match[1] ?? '')
    .replace(/\b(DISTINCT|ALL)\b/gi, ' ')
    .replace(/\bFIRST\s+\d+(\s+SKIP\s+\d+)?\b/gi, ' ')
    .trim();

  if (/^\*$/i.test(selectList)) {
    return true;
  }

  return /\b[A-Za-z_][A-Za-z0-9_$]*\.\*/.test(selectList);
}

export async function assertNoWildcardSelectOnSensitiveTables(
  sql: string,
  registry: ITableSchemaRegistry
): Promise<void> {
  if (!hasWildcardSelect(sql)) {
    return;
  }

  const tables = extractTableNamesFromSql(sql);
  for (const table of tables) {
    const schema = await registry.getTableSchema(table);

    if (schema.hasSensitiveColumns) {
      const names = Array.from(schema.sensitiveFields).join(', ');
      throw new SensitiveColumnError(
        `Table ${table} contains protected fields (${names}). ` +
          'Do not use SELECT * — list specific columns excluding passwords and secrets. ' +
          `Таблица ${table} содержит защищённые поля (${names}); укажите конкретные колонки без паролей.`
      );
    }
  }
}
