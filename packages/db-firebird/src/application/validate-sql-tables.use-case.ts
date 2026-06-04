import type { ISchemaReader } from '../ports/ISchemaReader';
import { extractTableNamesFromSql } from '../infrastructure/sql-table-names';

export interface ValidateSqlTablesResult {
  tables: string[];
  unknownTables: string[];
  valid: boolean;
}

export class ValidateSqlTablesUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  async run(sql: string): Promise<ValidateSqlTablesResult> {
    const tables = extractTableNamesFromSql(sql);
    if (tables.length === 0) {
      return { tables: [], unknownTables: [], valid: true };
    }

    const unknownTables = await this.schemaReader.findUnknownTableNames(tables);
    return {
      tables,
      unknownTables,
      valid: unknownTables.length === 0,
    };
  }
}
