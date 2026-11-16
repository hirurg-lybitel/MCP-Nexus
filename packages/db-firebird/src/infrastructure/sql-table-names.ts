/**
 * Extract relation names after FROM / JOIN (read-only SQL preflight).
 * Ignores FROM inside EXTRACT / TRIM / SUBSTRING and treats CTE names as non-tables.
 */

const SQL_KEYWORDS = new Set([
  'SELECT',
  'WHERE',
  'ON',
  'AND',
  'OR',
  'AS',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'NATURAL',
  'LATERAL',
  'RECURSIVE',
  'VALUES',
]);

const FUNCTION_NAMES_WITH_FROM = ['EXTRACT', 'TRIM', 'SUBSTRING', 'POSITION'];

function isSqlKeyword(name: string): boolean {
  return SQL_KEYWORDS.has(name.toUpperCase());
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');
}

/** Index just past the closing ')' of a balanced paren span starting at openIdx. */
function skipBalancedParens(sql: string, openIdx: number): number {
  if (sql[openIdx] !== '(') return openIdx;
  let depth = 0;
  for (let i = openIdx; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return sql.length;
}

/** Replace a balanced (...) span starting at openIdx with spaces (keeps length). */
function blankBalancedParens(sql: string, openIdx: number): string {
  const end = skipBalancedParens(sql, openIdx);
  const blank = ' '.repeat(Math.max(0, end - openIdx));
  return sql.slice(0, openIdx) + blank + sql.slice(end);
}

/** Mask EXTRACT(...)/TRIM(...)/SUBSTRING(...) so inner FROM is not a table. */
export function maskSqlFunctionsWithFrom(sql: string): string {
  let out = sql;
  const re = new RegExp(
    `\\b(?:${FUNCTION_NAMES_WITH_FROM.join('|')})\\s*\\(`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(out)) !== null) {
    const openIdx = match.index + match[0].length - 1;
    out = blankBalancedParens(out, openIdx);
    re.lastIndex = match.index + match[0].length;
  }
  return out;
}

function readIdentifier(
  sql: string,
  start: number
): { name: string; end: number } | null {
  let i = start;
  while (i < sql.length && /\s/.test(sql[i]!)) i++;
  const m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(sql.slice(i));
  if (!m) return null;
  return { name: m[0], end: i + m[0].length };
}

/** CTE names declared in WITH [RECURSIVE] name AS (...), ... */
export function extractCteNamesFromSql(sql: string): string[] {
  const cleaned = maskSqlFunctionsWithFrom(stripComments(sql));
  const withMatch = /\bWITH\b/i.exec(cleaned);
  if (!withMatch) return [];

  const names: string[] = [];
  let i = withMatch.index! + withMatch[0].length;
  const recursive = readIdentifier(cleaned, i);
  if (recursive && recursive.name.toUpperCase() === 'RECURSIVE') {
    i = recursive.end;
  }

  while (i < cleaned.length) {
    const ident = readIdentifier(cleaned, i);
    if (!ident) break;
    if (ident.name.toUpperCase() === 'SELECT') break;
    i = ident.end;

    const asKw = readIdentifier(cleaned, i);
    if (asKw && asKw.name.toUpperCase() === 'AS') {
      i = asKw.end;
    }

    while (i < cleaned.length && /\s/.test(cleaned[i]!)) i++;
    if (cleaned[i] !== '(') break;
    i = skipBalancedParens(cleaned, i);
    names.push(ident.name.toUpperCase());
    while (i < cleaned.length && /\s/.test(cleaned[i]!)) i++;
    if (cleaned[i] === ',') {
      i++;
      continue;
    }
    break;
  }

  return names;
}

export function extractTableNamesFromSql(sql: string): string[] {
  const masked = maskSqlFunctionsWithFrom(stripComments(sql));
  const cteNames = new Set(extractCteNamesFromSql(sql));

  const found = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_$]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(masked)) !== null) {
    const name = match[1]?.trim().toUpperCase();
    if (name && !isSqlKeyword(name) && !cteNames.has(name)) {
      found.add(name);
    }
  }

  return Array.from(found);
}
