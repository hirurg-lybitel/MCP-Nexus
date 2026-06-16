import type { ColumnInfo, ISchemaReader } from '../ports/ISchemaReader';
import type { ITableSchemaRegistry } from '../ports/ITableSchemaRegistry';

export interface DescribeTableResult {
  tableName: string;
  tableDisplayName: string | null;
  columns: ColumnInfo[];
}

export class DescribeTableUseCase {
  constructor(
    private readonly schemaRegistry: ITableSchemaRegistry,
    private readonly schemaReader: ISchemaReader
  ) {}

  async run(tableName: string): Promise<DescribeTableResult> {
    const normalized = tableName.trim().toUpperCase();
    const [schema, tableDisplayName] = await Promise.all([
      this.schemaRegistry.getTableSchema(normalized),
      this.schemaReader.getTableDisplayName(normalized),
    ]);

    return {
      tableName: schema.tableName,
      tableDisplayName,
      columns: schema.columns,
    };
  }
}
