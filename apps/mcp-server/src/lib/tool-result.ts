import { getDataCutoff } from './data-cutoff.js';

export async function toolSuccess(payload: Record<string, unknown>) {
  const dataCutoff = await getDataCutoff();
  const enriched =
    dataCutoff != null && payload.dataCutoff == null
      ? { ...payload, dataCutoff }
      : payload;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(enriched) }],
    structuredContent: enriched,
  };
}

export function toolFailure(code: string, message: string, extra?: Record<string, unknown>) {
  const payload = { error: message, code, ...extra };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true as const,
  };
}

export function mapDbError(error: unknown): ReturnType<typeof toolFailure> {
  const name = error instanceof Error ? error.constructor.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);

  const codeByName: Record<string, string> = {
    FirebirdConfigError: 'FIREBIRD_NOT_CONFIGURED',
    FirebirdUnsupportedEngineError: 'FIREBIRD_UNSUPPORTED_ENGINE',
    ReadOnlySqlError: 'READ_ONLY_SQL',
    SensitiveColumnError: 'SENSITIVE_COLUMN',
    DialectSqlError: 'DIALECT_SQL',
    UnknownTablesError: 'UNKNOWN_TABLES',
    FirebirdQueryError: 'QUERY_ERROR',
  };

  return toolFailure(codeByName[name] ?? 'UNKNOWN', message);
}
