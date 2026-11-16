type SqlRunner = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

let cachedCutoff: string | null | undefined;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const DATA_CUTOFF_SQL = `
WITH c AS (
  SELECT COALESCE(
    MAX(CASE WHEN entrydate <= CURRENT_DATE THEN entrydate END),
    MAX(CASE WHEN EXTRACT(YEAR FROM entrydate) <= 2100 THEN entrydate END),
    MAX(entrydate)
  ) AS dt
  FROM ac_entry
)
SELECT
  EXTRACT(YEAR FROM dt) AS y,
  EXTRACT(MONTH FROM dt) AS m,
  EXTRACT(DAY FROM dt) AS d
FROM c`;

export async function queryDataCutoff(db: SqlRunner): Promise<string | null> {
  const result = await db.executeSql.run(DATA_CUTOFF_SQL);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const y = Number(row?.Y ?? row?.y);
  const m = Number(row?.M ?? row?.m);
  const d = Number(row?.D ?? row?.d);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    y <= 0
  ) {
    return null;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Latest realistic AC_ENTRY.ENTRYDATE in the connected database (YYYY-MM-DD),
 * ignoring future-dated typos (e.g. year 9026 — BUG-06). Cached per process.
 */
export async function getDataCutoff(): Promise<string | null> {
  if (cachedCutoff !== undefined) return cachedCutoff;
  try {
    const { requireDbServices } = await import('@mcp-nexus/db-firebird');
    const db = requireDbServices();
    cachedCutoff = await queryDataCutoff(db);
    return cachedCutoff;
  } catch {
    cachedCutoff = null;
    return null;
  }
}

export function resetDataCutoffCache(): void {
  cachedCutoff = undefined;
}
