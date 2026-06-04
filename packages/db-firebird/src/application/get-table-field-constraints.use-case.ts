import type { ISchemaReader } from '../ports/ISchemaReader';
import type { TableFieldConstraints } from '../ports/table-field-constraints';

export class GetTableFieldConstraintsUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  run(tableName: string): Promise<TableFieldConstraints> {
    return this.schemaReader.getTableFieldConstraints(tableName);
  }
}
