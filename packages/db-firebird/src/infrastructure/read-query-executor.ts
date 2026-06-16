import {
  TransactionIsolation,
  type Attachment,
  type Transaction,
} from 'node-firebird-driver-native';
import type { IFirebirdConfig } from '../config/firebird-config';
import { FirebirdQueryError } from '../domain/errors';
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
        const rows = (await resultSet.fetchAsObject()) as Record<string, unknown>[];
        if (!applyRowLimit) {
          return {
            rows: redactSensitiveRows(rows, this.classifier),
            rowCount: rows.length,
            truncated: false,
          };
        }
        const limited = rows.slice(0, this.config.maxRows);
        return {
          rows: redactSensitiveRows(limited, this.classifier),
          rowCount: limited.length,
          truncated: rows.length > this.config.maxRows,
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
