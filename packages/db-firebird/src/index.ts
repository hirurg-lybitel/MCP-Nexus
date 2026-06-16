import type { IFirebirdConfig } from './config/firebird-config';
import { loadFirebirdConfig } from './config/firebird-config';
import { createDefaultPatternSet } from './domain/sensitivity/pattern-set';
import { FirebirdConfigError } from './domain/errors';
import { ExecuteSqlUseCase } from './application/execute-sql.use-case';
import { ListTablesUseCase } from './application/list-tables.use-case';
import { DescribeTableUseCase } from './application/describe-table.use-case';
import { ResolveFieldLabelsUseCase } from './application/resolve-field-labels.use-case';
import { GetTableDisplayNameUseCase } from './application/get-table-display-name.use-case';
import { SearchTablesUseCase } from './application/search-tables.use-case';
import { ValidateSqlTablesUseCase } from './application/validate-sql-tables.use-case';
import { GetTableFieldConstraintsUseCase } from './application/get-table-field-constraints.use-case';
import { ValidateSqlSensitiveUseCase } from './application/validate-sql-sensitive.use-case';
import { RunValidatedQueryUseCase } from './application/run-validated-query.use-case';
import { FirebirdConnection } from './infrastructure/firebird-connection';
import { ReadQueryExecutor } from './infrastructure/read-query-executor';
import { SchemaReader } from './infrastructure/schema-reader';
import { PatternSensitiveFieldClassifier } from './infrastructure/sensitivity/pattern-sensitive-field-classifier';
import { CachingTableSchemaRegistry } from './infrastructure/sensitivity/caching-table-schema-registry';

export type { IFirebirdConfig } from './config/firebird-config';
export { loadFirebirdConfig, buildConnectionString } from './config/firebird-config';
export {
  FirebirdConfigError,
  ReadOnlySqlError,
  FirebirdQueryError,
  SensitiveColumnError,
  UnknownTablesError,
} from './domain/errors';
export type { FieldDescriptor } from './domain/sensitivity/field-descriptor';
export type {
  SensitivitySignal,
  SensitivityVerdict,
} from './domain/sensitivity/sensitivity-verdict';
export type { PatternSet } from './domain/sensitivity/pattern-set';
export { createDefaultPatternSet } from './domain/sensitivity/pattern-set';
export type { QueryResultSummary } from './domain/query-result-summary';
export { summarizeQueryResult } from './domain/query-result-summary';
export type { QueryResult, QueryParams } from './ports/IReadQueryExecutor';
export type { TableInfo, ColumnInfo } from './ports/ISchemaReader';
export type { ISensitiveFieldClassifier } from './ports/ISensitiveFieldClassifier';
export type { ITableSchemaRegistry, TableSchema } from './ports/ITableSchemaRegistry';
export type {
  TableFieldConstraints,
  TableFieldConstraintRow,
  FieldConstraintType,
} from './ports/table-field-constraints';
export type { DescribeTableResult } from './application/describe-table.use-case';
export { assertReadOnlySql } from './infrastructure/read-only-sql-guard';
export { extractTableNamesFromSql } from './infrastructure/sql-table-names';
export {
  isSensitiveColumn,
  redactSensitiveRows,
  REDACTED_VALUE,
  getDefaultSensitiveFieldClassifier,
} from './infrastructure/sensitivity/sensitive-field-compat';
export { hasWildcardSelect } from './infrastructure/sensitive-sql-guard';

export interface DbServices {
  executeSql: ExecuteSqlUseCase;
  runValidatedQuery: RunValidatedQueryUseCase;
  listTables: ListTablesUseCase;
  describeTable: DescribeTableUseCase;
  resolveFieldLabels: ResolveFieldLabelsUseCase;
  getTableDisplayName: GetTableDisplayNameUseCase;
  searchTables: SearchTablesUseCase;
  validateSqlTables: ValidateSqlTablesUseCase;
  validateSqlSensitive: ValidateSqlSensitiveUseCase;
  getTableFieldConstraints: GetTableFieldConstraintsUseCase;
  schemaRegistry: CachingTableSchemaRegistry;
  dispose: () => Promise<void>;
}

export function createDbServices(config: IFirebirdConfig): DbServices {
  const connection = new FirebirdConnection(config);
  const patternSet = createDefaultPatternSet();
  const classifier = new PatternSensitiveFieldClassifier(patternSet);
  const readExecutor = new ReadQueryExecutor(connection, config, classifier);
  const schemaReader = new SchemaReader(readExecutor);
  const schemaRegistry = new CachingTableSchemaRegistry(
    schemaReader,
    classifier
  );

  const executeSql = new ExecuteSqlUseCase(readExecutor);
  const validateSqlTables = new ValidateSqlTablesUseCase(schemaReader);
  const validateSqlSensitive = new ValidateSqlSensitiveUseCase(schemaRegistry);

  return {
    executeSql,
    runValidatedQuery: new RunValidatedQueryUseCase(
      validateSqlTables,
      validateSqlSensitive,
      executeSql
    ),
    listTables: new ListTablesUseCase(schemaReader),
    describeTable: new DescribeTableUseCase(schemaRegistry, schemaReader),
    resolveFieldLabels: new ResolveFieldLabelsUseCase(schemaReader),
    getTableDisplayName: new GetTableDisplayNameUseCase(schemaReader),
    searchTables: new SearchTablesUseCase(schemaReader),
    validateSqlTables,
    validateSqlSensitive,
    getTableFieldConstraints: new GetTableFieldConstraintsUseCase(schemaReader),
    schemaRegistry,
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
