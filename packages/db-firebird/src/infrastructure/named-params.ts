export function convertNamedParams(
  sql: string,
  params: Record<string, unknown>
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];

  const sqlWithPlaceholders = sql.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
    if (!(name in params) && !(name.toUpperCase() in params)) {
      throw new Error(`Missing SQL parameter: ${name}`);
    }
    const value = name in params ? params[name] : params[name.toUpperCase()];
    values.push(value);
    return '?';
  });

  return { sql: sqlWithPlaceholders, values };
}
