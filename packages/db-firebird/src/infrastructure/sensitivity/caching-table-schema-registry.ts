import type { ColumnInfo } from '../../ports/ISchemaReader';
import type { ISchemaReader } from '../../ports/ISchemaReader';
import type { ISensitiveFieldClassifier } from '../../ports/ISensitiveFieldClassifier';
import type {
  ITableSchemaRegistry,
  TableSchema,
} from '../../ports/ITableSchemaRegistry';

function enrichColumn(
  column: ColumnInfo,
  classifier: ISensitiveFieldClassifier
): ColumnInfo {
  const verdict = classifier.classify({
    fieldName: column.fieldName,
    displayName: column.displayName,
  });

  if (!verdict.sensitive) {
    return column;
  }

  return {
    ...column,
    sensitive: true,
    sensitivitySignals: verdict.signals,
  };
}

export class CachingTableSchemaRegistry implements ITableSchemaRegistry {
  private readonly cache = new Map<string, TableSchema>();

  constructor(
    private readonly schemaReader: ISchemaReader,
    private readonly classifier: ISensitiveFieldClassifier
  ) {}

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const normalized = tableName.trim().toUpperCase();
    if (!normalized) {
      throw new Error('Table name is required.');
    }

    const cached = this.cache.get(normalized);
    if (cached) {
      return cached;
    }

    const rawColumns = await this.schemaReader.describeTable(normalized);
    const columns = rawColumns.map((column) =>
      enrichColumn(column, this.classifier)
    );

    const sensitiveFields = new Set<string>(
      columns.filter((col) => col.sensitive).map((col) => col.fieldName)
    );

    const schema: TableSchema = {
      tableName: normalized,
      columns,
      sensitiveFields,
      hasSensitiveColumns: sensitiveFields.size > 0,
    };

    this.cache.set(normalized, schema);
    return schema;
  }

  invalidate(tableName?: string): void {
    if (tableName) {
      this.cache.delete(tableName.trim().toUpperCase());
      return;
    }
    this.cache.clear();
  }
}
