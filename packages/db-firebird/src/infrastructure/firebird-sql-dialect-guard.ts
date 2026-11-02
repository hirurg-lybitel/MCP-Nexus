import type { FirebirdSqlDialect } from '../sql-dialect';
import { DialectSqlError } from '../domain/errors';

/**
 * Firebird 2.1+ supports non-recursive CTEs (WITH). Window functions and
 * OFFSET/FETCH appear in 3.0. Dialect '2.5' therefore allows WITH but blocks
 * windows and RECURSIVE; dialect '3' allows all of the above.
 */
const DIALECT_25_MESSAGE =
  'Window functions and WITH RECURSIVE are unavailable on Firebird 2.5. ' +
  'Non-recursive WITH (CTE) is allowed. Prefer SELECT FIRST … ORDER BY when possible.';

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
  /\bOFFSET\s+\d+/i,
  /\bFETCH\s+(FIRST|NEXT)\b/i,
] as const;

export function assertDialectCompatibleSql(
  sql: string,
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

  if (/\bWITH\s+RECURSIVE\b/i.test(withoutComments)) {
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
