export class FirebirdConfigError extends Error {
  constructor(message = 'Firebird is not configured. Set NODE_FB_HOST, NODE_FB_PORT, NODE_FB_DB, ISC_USER, ISC_PASSWORD.') {
    super(message);
    this.name = 'FirebirdConfigError';
  }
}

export class ReadOnlySqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlySqlError';
  }
}

export class FirebirdQueryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'FirebirdQueryError';
  }
}

export class UnknownTablesError extends FirebirdQueryError {
  constructor(
    message: string,
    readonly unknownTables: string[],
    readonly referencedTables: string[]
  ) {
    super(message);
    this.name = 'UnknownTablesError';
  }
}

export class SensitiveColumnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SensitiveColumnError';
  }
}

export class DialectSqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DialectSqlError';
  }
}
