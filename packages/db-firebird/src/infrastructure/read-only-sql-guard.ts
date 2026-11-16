import { ReadOnlySqlError } from '../domain/errors';

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|EXECUTE|EXEC|DDL|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|SET\s+TRANSACTION)\b/i;

/** Firebird-specific write/side-effect patterns inside SELECT. */
const FORBIDDEN_PATTERNS = [
  /\bFOR\s+UPDATE\b/i,
  /\bINTO\b/i,
] as const;

/** GEN_ID(name, 0) only reads the generator (platform CLOSEDATE). Non-zero step mutates. */
const GEN_ID_MUTATING = /\bGEN_ID\s*\(\s*[^,]+,\s*(?!0\s*\))(-?\d+|:[a-z_][\w$]*|[a-z_][\w$]*)\s*\)/i;

export function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new ReadOnlySqlError('SQL must not be empty.');
  }

  if (trimmed.includes(';')) {
    throw new ReadOnlySqlError('Multiple statements are not allowed (semicolon detected).');
  }

  const withoutComments = stripSqlComments(trimmed);

  if (FORBIDDEN_KEYWORDS.test(withoutComments)) {
    throw new ReadOnlySqlError('Only read-only SELECT queries are allowed.');
  }

  if (GEN_ID_MUTATING.test(withoutComments)) {
    throw new ReadOnlySqlError('Only read-only SELECT queries are allowed.');
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(withoutComments)) {
      throw new ReadOnlySqlError('Only read-only SELECT queries are allowed.');
    }
  }

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
