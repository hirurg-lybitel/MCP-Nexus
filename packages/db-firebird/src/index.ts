import type { IFirebirdConfig } from './config/firebird-config';
import { loadFirebirdConfig } from './config/firebird-config';
import { FirebirdConfigError } from './domain/errors';
import { ExecuteSqlUseCase } from './application/execute-sql.use-case';
import { ListTablesUseCase } from './application/list-tables.use-case';
import { DescribeTableUseCase } from './application/describe-table.use-case';
import { ResolveFieldLabelsUseCase } from './application/resolve-field-labels.use-case';
import { GetTableDisplayNameUseCase } from './application/get-table-display-name.use-case';
import { SearchTablesUseCase } from './application/search-tables.use-case';
import { ValidateSqlTablesUseCase } from './application/validate-sql-tables.use-case';
import { GetTableFieldConstraintsUseCase } from './application/get-table-field-constraints.use-case';
import { FirebirdConnection } from './infrastructure/firebird-connection';
import { ReadQueryExecutor } from './infrastructure/read-query-executor';
import { SchemaReader } from './infrastructure/schema-reader';

export type { IFirebirdConfig } from './config/firebird-config';
export { loadFirebirdConfig, buildConnectionString } from './config/firebird-config';
export {
  FirebirdConfigError,
  ReadOnlySqlError,
  FirebirdQueryError,
} from './domain/errors';
export type { QueryResult, QueryParams } from './ports/IReadQueryExecutor';
export type { TableInfo, ColumnInfo } from './ports/ISchemaReader';
export type {
  TableFieldConstraints,
  TableFieldConstraintRow,
  FieldConstraintType,
} from './ports/table-field-constraints';
export type { DescribeTableResult } from './application/describe-table.use-case';
export { assertReadOnlySql } from './infrastructure/read-only-sql-guard';
export { extractTableNamesFromSql } from './infrastructure/sql-table-names';

export interface DbServices {
  executeSql: ExecuteSqlUseCase;
  listTables: ListTablesUseCase;
  describeTable: DescribeTableUseCase;
  resolveFieldLabels: ResolveFieldLabelsUseCase;
  getTableDisplayName: GetTableDisplayNameUseCase;
  searchTables: SearchTablesUseCase;
  validateSqlTables: ValidateSqlTablesUseCase;
  getTableFieldConstraints: GetTableFieldConstraintsUseCase;
  dispose: () => Promise<void>;
}

export function createDbServices(config: IFirebirdConfig): DbServices {
  const connection = new FirebirdConnection(config);
  const readExecutor = new ReadQueryExecutor(connection, config);
  const schemaReader = new SchemaReader(connection, config);

  return {
    executeSql: new ExecuteSqlUseCase(readExecutor),
    listTables: new ListTablesUseCase(schemaReader),
    describeTable: new DescribeTableUseCase(schemaReader),
    resolveFieldLabels: new ResolveFieldLabelsUseCase(schemaReader),
    getTableDisplayName: new GetTableDisplayNameUseCase(schemaReader),
    searchTables: new SearchTablesUseCase(schemaReader),
    validateSqlTables: new ValidateSqlTablesUseCase(schemaReader),
    getTableFieldConstraints: new GetTableFieldConstraintsUseCase(schemaReader),
    dispose: () => connection.dispose(),
  };
}

let sharedServices: DbServices | null | undefined;

/** Lazy singleton for the MCP process composition root. */
export function getDbServices(): DbServices | null {
  if (sharedServices !== undefined) {
    return sharedServices;
  }

  const config = loadFirebirdConfig();
  if (!config) {
    sharedServices = null;
    return null;
  }

  sharedServices = createDbServices(config);
  return sharedServices;
}

export function requireDbServices(): DbServices {
  const services = getDbServices();
  if (!services) {
    throw new FirebirdConfigError();
  }
  return services;
}

export async function disposeDbServices(): Promise<void> {
  if (sharedServices) {
    await sharedServices.dispose();
  }
  sharedServices = undefined;
}
