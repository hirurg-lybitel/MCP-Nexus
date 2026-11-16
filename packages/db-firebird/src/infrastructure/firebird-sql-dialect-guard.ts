import type { FirebirdSqlDialect } from '../sql-dialect';
import { DialectSqlError } from '../domain/errors';

/**
 * Target runtime is Firebird 5 (profile '3'): no SQL feature stripping.
 * Profile '2.5' is a legacy override for unit tests / emergency local use only —
 * client databases on 2.5 must be upgraded to Firebird 5 (D2 / D20).
 */
const DIALECT_25_MESSAGE =
  'This SQL needs Firebird 5 (window functions, WITH RECURSIVE, or OFFSET/FETCH). ' +
  'Client databases on Firebird 2.5 must be upgraded. ' +
  'Non-recursive WITH (CTE) is allowed even on the legacy 2.5 profile.';

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
