export function toolSuccess(payload: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
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
    ReadOnlySqlError: 'READ_ONLY_SQL',
    SensitiveColumnError: 'SENSITIVE_COLUMN',
    DialectSqlError: 'DIALECT_SQL',
    UnknownTablesError: 'UNKNOWN_TABLES',
    FirebirdQueryError: 'QUERY_ERROR',
  };

  return toolFailure(codeByName[name] ?? 'UNKNOWN', message);
}
