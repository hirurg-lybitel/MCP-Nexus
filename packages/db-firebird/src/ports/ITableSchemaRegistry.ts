import type { ColumnInfo } from './ISchemaReader';

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  sensitiveFields: ReadonlySet<string>;
  hasSensitiveColumns: boolean;
}

export interface ITableSchemaRegistry {
  getTableSchema(tableName: string): Promise<TableSchema>;
  invalidate(tableName?: string): void;
}
