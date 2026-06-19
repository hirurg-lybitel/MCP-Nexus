export const FIREBIRD_TOOL_NAMES = [
  'execute_sql',
  'search_tables',
  'describe_table',
  'list_tables',
] as const;

export type FirebirdToolName = (typeof FIREBIRD_TOOL_NAMES)[number];

const FIREBIRD_TOOL_SET = new Set<string>(FIREBIRD_TOOL_NAMES);

export function isFirebirdTool(toolName: string): toolName is FirebirdToolName {
  return FIREBIRD_TOOL_SET.has(toolName);
}

function parseJsonRecord(text: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export interface TableInfo {
  tableName: string;
  displayName?: string | null;
  description?: string | null;
}

export interface DescribeColumnInfo {
  fieldName: string;
  displayName?: string | null;
  fieldType?: string | null;
  refTable?: string | null;
  refListField?: string | null;
  sensitive?: boolean;
}

export interface ExecuteSqlParsed {
  kind: 'success';
  rowCount: number;
  columns: string[];
  truncated: boolean;
  sql?: string;
}

export interface ExecuteSqlError {
  kind: 'error';
  message: string;
}

export type ExecuteSqlView = ExecuteSqlParsed | ExecuteSqlError;

export function parseExecuteSqlTool(
  toolInput: Record<string, unknown> | undefined,
  toolResult: string
): ExecuteSqlView {
  const payload = parseJsonRecord(toolResult);
  if (!payload) {
    return { kind: 'error', message: toolResult.trim() || 'Invalid result' };
  }

  if (typeof payload.error === 'string') {
    return { kind: 'error', message: payload.error };
  }

  const rowCount =
    typeof payload.rowCount === 'number' ? payload.rowCount : 0;
  const columns = Array.isArray(payload.columns)
    ? payload.columns.filter((c): c is string => typeof c === 'string')
    : [];
  const truncated = Boolean(payload.truncated);
  const sql =
    typeof toolInput?.sql === 'string' ? toolInput.sql.trim() : undefined;

  return { kind: 'success', rowCount, columns, truncated, sql };
}

export interface SearchTablesParsed {
  kind: 'success' | 'error';
  query?: string;
  tables: TableInfo[];
  error?: string;
}

export function parseSearchTablesTool(
  toolInput: Record<string, unknown> | undefined,
  toolResult: string
): SearchTablesParsed {
  const payload = parseJsonRecord(toolResult);
  if (!payload) {
    return {
      kind: 'error',
      tables: [],
      error: toolResult.trim() || 'Invalid result',
    };
  }

  if (typeof payload.error === 'string') {
    return { kind: 'error', tables: [], error: payload.error };
  }

  const query =
    typeof payload.query === 'string'
      ? payload.query
      : typeof toolInput?.query === 'string'
        ? toolInput.query
        : undefined;

  const tables = parseTableList(payload.tables);

  return { kind: 'success', query, tables };
}

export interface ListTablesParsed {
  kind: 'success' | 'error';
  tables: TableInfo[];
  error?: string;
}

export function parseListTablesTool(toolResult: string): ListTablesParsed {
  const payload = parseJsonRecord(toolResult);
  if (!payload) {
    return {
      kind: 'error',
      tables: [],
      error: toolResult.trim() || 'Invalid result',
    };
  }

  if (typeof payload.error === 'string') {
    return { kind: 'error', tables: [], error: payload.error };
  }

  return { kind: 'success', tables: parseTableList(payload.tables) };
}

export interface DescribeTableParsed {
  kind: 'success' | 'error';
  tableName?: string;
  tableDisplayName?: string | null;
  columns: DescribeColumnInfo[];
  error?: string;
}

export function parseDescribeTableTool(
  toolInput: Record<string, unknown> | undefined,
  toolResult: string
): DescribeTableParsed {
  const payload = parseJsonRecord(toolResult);
  if (!payload) {
    return {
      kind: 'error',
      columns: [],
      error: toolResult.trim() || 'Invalid result',
    };
  }

  if (typeof payload.error === 'string') {
    return { kind: 'error', columns: [], error: payload.error };
  }

  const tableName =
    typeof payload.tableName === 'string'
      ? payload.tableName
      : typeof toolInput?.tableName === 'string'
        ? toolInput.tableName
        : undefined;

  const tableDisplayName =
    typeof payload.tableDisplayName === 'string'
      ? payload.tableDisplayName
      : null;

  const columns = parseDescribeColumns(payload.columns);

  return {
    kind: 'success',
    tableName,
    tableDisplayName,
    columns,
  };
}

function parseTableList(raw: unknown): TableInfo[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
    )
    .map((item) => ({
      tableName: String(item.tableName ?? ''),
      displayName:
        typeof item.displayName === 'string' ? item.displayName : null,
      description:
        typeof item.description === 'string' ? item.description : null,
    }))
    .filter((t) => t.tableName.length > 0);
}

function parseDescribeColumns(raw: unknown): DescribeColumnInfo[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
    )
    .map((col) => ({
      fieldName: String(col.fieldName ?? ''),
      displayName:
        typeof col.displayName === 'string' ? col.displayName : null,
      fieldType: typeof col.fieldType === 'string' ? col.fieldType : null,
      refTable: typeof col.refTable === 'string' ? col.refTable : null,
      refListField:
        typeof col.refListField === 'string' ? col.refListField : null,
      sensitive: col.sensitive === true,
    }))
    .filter((c) => c.fieldName.length > 0);
}

export function formatColumnList(columns: string[], max = 5): string {
  if (columns.length === 0) {
    return '';
  }
  const shown = columns.slice(0, max);
  const rest = columns.length - shown.length;
  const base = shown.join(', ');
  return rest > 0 ? `${base}, …` : base;
}

export function countSensitiveColumns(columns: DescribeColumnInfo[]): number {
  return columns.filter((c) => c.sensitive).length;
}
