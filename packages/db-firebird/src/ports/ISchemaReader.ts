export interface TableInfo {
  tableName: string;
  /** Localized title from AT_RELATIONS.LNAME / LSHORTNAME when available. */
  displayName?: string | null;
  description?: string | null;
}

import type { TableFieldConstraints } from './table-field-constraints';
import type { SensitivitySignal } from '../domain/sensitivity/sensitivity-verdict';

export interface ColumnInfo {
  fieldName: string;
  /** Localized title from AT_RELATION_FIELDS.LNAME / LSHORTNAME when available. */
  displayName?: string | null;
  fieldType: string | null;
  fieldLength: number | null;
  nullable: boolean;
  position: number;
  /** From RDB$RELATION_CONSTRAINTS (PRIMARY KEY / FOREIGN KEY). */
  constraintType?: 'PRIMARY KEY' | 'FOREIGN KEY' | null;
  /** Referenced table from AT_FIELDS / FK metadata (for *KEY fields). */
  refTable?: string | null;
  /** Display field on referenced table (often NAME). */
  refListField?: string | null;
  refTableDisplayName?: string | null;
  /** True for password/secret/token columns — must not be queried or displayed. */
  sensitive?: boolean;
  /** Which metadata signals marked the field sensitive (fieldName / displayName). */
  sensitivitySignals?: SensitivitySignal[];
}

export interface ISchemaReader {
  listTables(): Promise<TableInfo[]>;
  describeTable(tableName: string): Promise<ColumnInfo[]>;
  searchTables(query: string, limit?: number): Promise<TableInfo[]>;
  getTableDisplayName(tableName: string): Promise<string | null>;
  resolveFieldDisplayNames(
    tableName: string,
    fieldNames: string[]
  ): Promise<Record<string, string>>;
  findUnknownTableNames(tableNames: string[]): Promise<string[]>;
  getTableFieldConstraints(tableName: string): Promise<TableFieldConstraints>;
}
