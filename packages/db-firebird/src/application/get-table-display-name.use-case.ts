import type { ISchemaReader } from '../ports/ISchemaReader';

export class GetTableDisplayNameUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  run(tableName: string): Promise<string | null> {
    return this.schemaReader.getTableDisplayName(tableName);
  }
}
