import type { ISchemaReader, TableInfo } from '../ports/ISchemaReader';

export class SearchTablesUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  run(query: string, limit?: number): Promise<TableInfo[]> {
    return this.schemaReader.searchTables(query, limit);
  }
}
