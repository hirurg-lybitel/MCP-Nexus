import type { IReadQueryExecutor, QueryParams, QueryResult } from '../ports/IReadQueryExecutor';

export class ExecuteSqlUseCase {
  constructor(private readonly executor: IReadQueryExecutor) {}

  run(sql: string, params?: QueryParams): Promise<QueryResult> {
    return this.executor.execute(sql, params);
  }
}
