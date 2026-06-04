import type { ISchemaReader } from '../ports/ISchemaReader';

export class ResolveFieldLabelsUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  run(
    tableName: string,
    fieldNames: string[]
  ): Promise<Record<string, string>> {
    return this.schemaReader.resolveFieldDisplayNames(tableName, fieldNames);
  }
}
