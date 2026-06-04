import { ReadOnlySqlError } from '../domain/errors';

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|EXECUTE|EXEC|DDL|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|SET\s+TRANSACTION)\b/i;

export function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new ReadOnlySqlError('SQL must not be empty.');
  }

  if (trimmed.includes(';')) {
    throw new ReadOnlySqlError('Multiple statements are not allowed (semicolon detected).');
  }

  if (FORBIDDEN_KEYWORDS.test(trimmed)) {
    throw new ReadOnlySqlError('Only read-only SELECT queries are allowed.');
  }

  const withoutComments = stripSqlComments(trimmed);
  const firstToken = withoutComments.split(/\s+/)[0]?.toUpperCase();

  if (firstToken !== 'SELECT' && firstToken !== 'WITH') {
    throw new ReadOnlySqlError('Query must start with SELECT or WITH (read-only).');
  }
}

function stripSqlComments(sql: string): string {
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  result = result.replace(/--[^\n\r]*/g, ' ');
  return result.trim();
}
