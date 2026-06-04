/** Extract relation names after FROM / JOIN (read-only SQL preflight). */
export function extractTableNamesFromSql(sql: string): string[] {
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');

  const found = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_$]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutComments)) !== null) {
    const name = match[1]?.trim().toUpperCase();
    if (name && !isSqlKeyword(name)) {
      found.add(name);
    }
  }

  return Array.from(found);
}

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
]);

function isSqlKeyword(name: string): boolean {
  return SQL_KEYWORDS.has(name.toUpperCase());
}
