import { UnknownTablesError } from '../domain/errors';
import type { QueryParams, QueryResult } from '../ports/IReadQueryExecutor';
import type { ExecuteSqlUseCase } from './execute-sql.use-case';
import type { ValidateSqlSensitiveUseCase } from './validate-sql-sensitive.use-case';
import type { ValidateSqlTablesUseCase } from './validate-sql-tables.use-case';

export class RunValidatedQueryUseCase {
  constructor(
    private readonly validateSqlTables: ValidateSqlTablesUseCase,
    private readonly validateSqlSensitive: ValidateSqlSensitiveUseCase,
    private readonly executeSql: ExecuteSqlUseCase
  ) {}

  async run(sql: string, params?: QueryParams): Promise<QueryResult> {
    const validation = await this.validateSqlTables.run(sql);
    if (!validation.valid) {
      throw new UnknownTablesError(
        `Unknown table(s): ${validation.unknownTables.join(', ')}. Use search_tables or list_tables — do not invent names.`,
        validation.unknownTables,
        validation.tables
      );
    }

    await this.validateSqlSensitive.run(sql);
    return this.executeSql.run(sql, params);
  }
}
