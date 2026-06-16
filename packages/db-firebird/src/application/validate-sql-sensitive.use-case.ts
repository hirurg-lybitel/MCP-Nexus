import type { ITableSchemaRegistry } from '../ports/ITableSchemaRegistry';
import { assertNoWildcardSelectOnSensitiveTables } from '../infrastructure/sensitive-sql-guard';

export class ValidateSqlSensitiveUseCase {
  constructor(private readonly schemaRegistry: ITableSchemaRegistry) {}

  async run(sql: string): Promise<void> {
    await assertNoWildcardSelectOnSensitiveTables(sql, this.schemaRegistry);
  }
}
