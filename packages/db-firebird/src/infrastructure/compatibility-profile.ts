import type { IReadQueryExecutor } from '../ports/IReadQueryExecutor';
import type { IFirebirdConnection } from '../ports/IFirebirdConnection';
import { parseFirebirdEngineMajor } from './firebird-engine-version.js';

export interface UnavailableTable {
  table: string;
  columns: string[];
  functions: string[];
  reason: string;
}

export interface CompatibilityProfile {
  engineVersion: string | null;
  engineMajor: number | null;
  udf: {
    checkedAt: string;
    brokenFunctions: string[];
    unavailableTables: UnavailableTable[];
  };
}

const COMPUTED_UDF_COLUMNS_SQL = `
SELECT
  TRIM(RF.RDB$RELATION_NAME) AS TABLE_NAME,
  TRIM(RF.RDB$FIELD_NAME) AS FIELD_NAME,
  CAST(F.RDB$COMPUTED_SOURCE AS VARCHAR(8000)) AS COMPUTED_SOURCE
FROM RDB$RELATION_FIELDS RF
JOIN RDB$FIELDS F ON F.RDB$FIELD_NAME = RF.RDB$FIELD_SOURCE
JOIN RDB$RELATIONS R ON R.RDB$RELATION_NAME = RF.RDB$RELATION_NAME
WHERE F.RDB$COMPUTED_SOURCE IS NOT NULL
  AND COALESCE(R.RDB$SYSTEM_FLAG, 0) = 0
  AND R.RDB$VIEW_BLR IS NULL
`;

const EXTERNAL_FUNCTIONS_SQL = `
SELECT TRIM(RDB$FUNCTION_NAME) AS FUNCTION_NAME
FROM RDB$FUNCTIONS
WHERE RDB$MODULE_NAME IS NOT NULL
`;

const FUNCTION_ARG_COUNT_SQL = `
SELECT
  TRIM(RDB$FUNCTION_NAME) AS FUNCTION_NAME,
  COUNT(*) AS ARG_COUNT
FROM RDB$FUNCTION_ARGUMENTS
WHERE RDB$ARGUMENT_POSITION > 0
GROUP BY 1
`;

/** Identifiers that look like UDF calls inside computed source. */
const IDENT_RE = /\b([A-Za-z][A-Za-z0-9_$]*)\s*\(/g;

export function extractFunctionNames(
  computedSource: string,
  knownExternal: ReadonlySet<string>
): string[] {
  const found = new Set<string>();
  IDENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IDENT_RE.exec(computedSource)) !== null) {
    const name = match[1]!.toUpperCase();
    if (knownExternal.has(name)) {
      found.add(name);
    }
  }
  return [...found].sort();
}

function isUdfFailureMessage(message: string): boolean {
  return (
    /function .* is not defined/i.test(message) ||
    /module name or entrypoint could not be found/i.test(message) ||
    /Cannot find UDF/i.test(message)
  );
}

function quoteIdent(name: string): string {
  if (!/^[A-Z][A-Z0-9_$]*$/i.test(name)) {
    throw new Error(`Refusing to probe unsafe identifier: ${name}`);
  }
  return name.toUpperCase();
}

export class CompatibilityProfileService {
  private cached: CompatibilityProfile | undefined;
  private loading: Promise<CompatibilityProfile> | undefined;

  constructor(
    private readonly connection: IFirebirdConnection,
    private readonly executor: IReadQueryExecutor
  ) {}

  async getProfile(forceRefresh = false): Promise<CompatibilityProfile> {
    if (this.cached && !forceRefresh) return this.cached;
    if (!this.loading) {
      this.loading = this.buildProfile().finally(() => {
        this.loading = undefined;
      });
    }
    return this.loading;
  }

  private async buildProfile(): Promise<CompatibilityProfile> {
    await this.connection.getAttachment();
    const version =
      (typeof this.connection.getEngineVersion === 'function'
        ? this.connection.getEngineVersion()
        : undefined) ?? null;
    const engineMajor = version ? parseFirebirdEngineMajor(version) : null;

    const fnResult = await this.executor.execute(
      EXTERNAL_FUNCTIONS_SQL,
      undefined,
      { applyRowLimit: false }
    );
    const knownExternal = new Set(
      fnResult.rows
        .map((r) =>
          String(r.FUNCTION_NAME ?? r.function_name ?? '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    );

    const argCounts = new Map<string, number>();
    const argResult = await this.executor.execute(
      FUNCTION_ARG_COUNT_SQL,
      undefined,
      { applyRowLimit: false }
    );
    for (const row of argResult.rows) {
      const name = String(row.FUNCTION_NAME ?? row.function_name ?? '')
        .trim()
        .toUpperCase();
      const count = Number(row.ARG_COUNT ?? row.arg_count ?? 0);
      if (name) argCounts.set(name, Number.isFinite(count) ? count : 0);
    }

    const computed = await this.executor.execute(
      COMPUTED_UDF_COLUMNS_SQL,
      undefined,
      { applyRowLimit: false }
    );

    type ColInfo = { field: string; functions: string[] };
    const byTable = new Map<string, ColInfo[]>();
    const usedFunctions = new Set<string>();

    for (const row of computed.rows) {
      const table = String(row.TABLE_NAME ?? row.table_name ?? '')
        .trim()
        .toUpperCase();
      const field = String(row.FIELD_NAME ?? row.field_name ?? '')
        .trim()
        .toUpperCase();
      const source = String(row.COMPUTED_SOURCE ?? row.computed_source ?? '');
      if (!table || !field) continue;
      const functions = extractFunctionNames(source, knownExternal);
      if (functions.length === 0) continue;
      for (const fn of functions) usedFunctions.add(fn);
      const list = byTable.get(table) ?? [];
      list.push({ field, functions });
      byTable.set(table, list);
    }

    const brokenFunctions = new Set<string>();
    for (const fn of usedFunctions) {
      const arity = argCounts.get(fn) ?? 1;
      const args = Array.from({ length: Math.max(arity, 0) }, () => 'NULL').join(
        ', '
      );
      const sql = `SELECT ${quoteIdent(fn)}(${args}) AS probe FROM RDB$DATABASE`;
      try {
        await this.executor.execute(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isUdfFailureMessage(message)) {
          brokenFunctions.add(fn);
        }
      }
    }

    const unavailableTables: UnavailableTable[] = [];
    for (const [table, cols] of byTable) {
      const functions = [
        ...new Set(cols.flatMap((c) => c.functions)),
      ].sort();
      const brokenHere = functions.filter((f) => brokenFunctions.has(f));
      if (brokenHere.length === 0) continue;
      unavailableTables.push({
        table,
        columns: cols.map((c) => c.field),
        functions: brokenHere,
        reason: `Computed field(s) depend on unavailable UDF: ${brokenHere.join(', ')}`,
      });
    }

    this.cached = {
      engineVersion: version,
      engineMajor,
      udf: {
        checkedAt: new Date().toISOString(),
        brokenFunctions: [...brokenFunctions].sort(),
        unavailableTables: unavailableTables.sort((a, b) =>
          a.table.localeCompare(b.table)
        ),
      },
    };
    return this.cached;
  }
}
