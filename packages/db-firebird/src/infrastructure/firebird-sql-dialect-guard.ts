import type { FirebirdSqlDialect } from '../sql-dialect';
import { DialectSqlError } from '../domain/errors';
const DIALECT_25_MESSAGE =
  'Window functions / CTEs are disabled for Firebird SQL dialect 2.5. ' +
  'Use a flat SELECT FIRST … ORDER BY. Row numbers are added automatically by the chat UI — do not use ROW_NUMBER in SQL.';

const WINDOW_FUNCTION_PATTERNS = [
  /\bOVER\s*\(/i,
  /\bROW_NUMBER\s*\(/i,
  /\bRANK\s*\(/i,
  /\bDENSE_RANK\s*\(/i,
  /\bNTILE\s*\(/i,
  /\bLEAD\s*\(/i,
  /\bLAG\s*\(/i,
  /\bFIRST_VALUE\s*\(/i,
  /\bLAST_VALUE\s*\(/i,
] as const;

export function assertDialectCompatibleSql(  sql: string,
  dialect: FirebirdSqlDialect
): void {
  if (dialect === '3') {
    return;
  }

  const trimmed = sql.trim();
  if (!trimmed) {
    return;
  }

  const withoutComments = stripSqlComments(trimmed);
  const firstToken = withoutComments.split(/\s+/)[0]?.toUpperCase();

  if (firstToken === 'WITH') {
    throw new DialectSqlError(DIALECT_25_MESSAGE);
  }

  if (
    /\bWITH\s+RECURSIVE\b/i.test(withoutComments) ||
    /\bRECURSIVE\b/i.test(withoutComments)
  ) {
    throw new DialectSqlError(DIALECT_25_MESSAGE);
  }

  for (const pattern of WINDOW_FUNCTION_PATTERNS) {
    if (pattern.test(withoutComments)) {
      throw new DialectSqlError(DIALECT_25_MESSAGE);
    }
  }
}

function stripSqlComments(sql: string): string {
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  result = result.replace(/--[^\n\r]*/g, ' ');
  return result.trim();
}
