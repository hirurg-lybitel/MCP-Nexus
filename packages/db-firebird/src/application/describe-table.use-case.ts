import type { ColumnInfo, ISchemaReader } from '../ports/ISchemaReader';

export interface DescribeTableResult {
  tableName: string;
  tableDisplayName: string | null;
  columns: ColumnInfo[];
}

export class DescribeTableUseCase {
  constructor(private readonly schemaReader: ISchemaReader) {}

  async run(tableName: string): Promise<DescribeTableResult> {
    const normalized = tableName.trim().toUpperCase();
    const [columns, tableDisplayName] = await Promise.all([
      this.schemaReader.describeTable(normalized),
      this.schemaReader.getTableDisplayName(normalized),
    ]);

    return {
      tableName: normalized,
      tableDisplayName,
      columns,
    };
  }
}
