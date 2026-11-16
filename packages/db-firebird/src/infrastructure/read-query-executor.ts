import {
  TransactionIsolation,
  type Attachment,
  type Transaction,
} from 'node-firebird-driver-native';
import type { IFirebirdConfig } from '../config/firebird-config';
import { FirebirdQueryError } from '../domain/errors';
import { assertDialectCompatibleSql } from './firebird-sql-dialect-guard';
import { assertReadOnlySql } from './read-only-sql-guard';
import { convertNamedParams } from './named-params';
import { redactSensitiveRows } from './sensitivity/redact-sensitive-rows';
import type { ISensitiveFieldClassifier } from '../ports/ISensitiveFieldClassifier';
import { getDefaultSensitiveFieldClassifier } from './sensitivity/sensitive-field-compat';
import type {
  IReadQueryExecutor,
  QueryParams,
  QueryResult,
  ReadQueryOptions,
} from '../ports/IReadQueryExecutor';
import type { IFirebirdConnection } from '../ports/IFirebirdConnection';
import { normalizeRowValues } from './normalize-query-value.js';

export class ReadQueryExecutor implements IReadQueryExecutor {
  constructor(
    private readonly connection: IFirebirdConnection,
    private readonly config: IFirebirdConfig,
    private readonly classifier: ISensitiveFieldClassifier = getDefaultSensitiveFieldClassifier()
  ) {}

  async execute(
    sql: string,
    params?: QueryParams,
    options?: ReadQueryOptions
  ): Promise<QueryResult> {
    assertReadOnlySql(sql);
    assertDialectCompatibleSql(sql, this.config.sqlDialect);

    const attachment = await this.connection.getAttachment();
    const { sql: executableSql, values } = params
      ? convertNamedParams(sql, params)
      : { sql, values: [] as unknown[] };

    return runWithTimeout(
      () =>
        this.runQuery(attachment, executableSql, values, options?.applyRowLimit !== false),
      this.config.queryTimeoutMs
    );
  }

  private async runQuery(
    attachment: Attachment,
    sql: string,
    values: unknown[],
    applyRowLimit: boolean
  ): Promise<QueryResult> {
    let transaction: Transaction | undefined;

    try {
      transaction = await attachment.startTransaction({
        isolation: TransactionIsolation.READ_COMMITTED,
        readCommittedMode: 'RECORD_VERSION',
        waitMode: 'NO_WAIT',
        accessMode: 'READ_ONLY',
      });

      const resultSet = await attachment.executeQuery(transaction, sql, values);

      try {
        const rawRows = (await resultSet.fetchAsObject()) as Record<
          string,
          unknown
        >[];
        const sliced = applyRowLimit
          ? rawRows.slice(0, this.config.maxRows)
          : rawRows;
        const normalized = await normalizeRowValues(
          sliced,
          attachment,
          transaction
        );
        const rows = redactSensitiveRows(normalized, this.classifier);
        return {
          rows,
          rowCount: rows.length,
          truncated: applyRowLimit && rawRows.length > this.config.maxRows,
        };
      } finally {
        await resultSet.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new FirebirdQueryError(message, error);
    } finally {
      if (transaction?.isValid) {
        try {
          await transaction.commit();
        } catch (error) {
          console.error('Read transaction commit failed:', error);
        }
      }
    }
  }
}

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new FirebirdQueryError(`Query timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
