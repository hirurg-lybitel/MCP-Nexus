export type QueryParams = Record<string, unknown>;

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export interface ReadQueryOptions {
  /** When false, returns all rows (for schema introspection). Default true. */
  applyRowLimit?: boolean;
}

export interface IReadQueryExecutor {
  execute(sql: string, params?: QueryParams, options?: ReadQueryOptions): Promise<QueryResult>;
}
