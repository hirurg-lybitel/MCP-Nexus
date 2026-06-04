import type { ISchemaReader, TableInfo } from '../ports/ISchemaReader';

export class ListTablesUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  run(): Promise<TableInfo[]> {
    return this.schemaReader.listTables();
  }
}
