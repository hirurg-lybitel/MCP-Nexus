import type {
  ColumnInfo,
  ISchemaReader,
  TableInfo,
} from '../ports/ISchemaReader';
import type {
  FieldConstraintType,
  TableFieldConstraints,
} from '../ports/table-field-constraints';
import type { IReadQueryExecutor } from '../ports/IReadQueryExecutor';

const DEFAULT_SEARCH_LIMIT = 30;

const LIST_TABLES_RDB_ONLY_SQL = `
SELECT TRIM(R.RDB$RELATION_NAME) AS TABLE_NAME
FROM RDB$RELATIONS R
WHERE COALESCE(R.RDB$SYSTEM_FLAG, 0) = 0
  AND R.RDB$VIEW_BLR IS NULL
ORDER BY 1
`;

const LIST_TABLES_SQL = `
SELECT
  TRIM(R.RDB$RELATION_NAME) AS TABLE_NAME,
  TRIM(AR.LNAME) AS LNAME,
  TRIM(AR.LSHORTNAME) AS LSHORTNAME
FROM RDB$RELATIONS R
LEFT JOIN AT_RELATIONS AR
  ON TRIM(AR.RELATIONNAME) = TRIM(R.RDB$RELATION_NAME)
WHERE COALESCE(R.RDB$SYSTEM_FLAG, 0) = 0
  AND R.RDB$VIEW_BLR IS NULL
ORDER BY 1
`;

const SEARCH_TABLES_SQL = `
SELECT FIRST :limit
  TRIM(AR.RELATIONNAME) AS TABLE_NAME,
  TRIM(AR.LNAME) AS LNAME,
  TRIM(AR.LSHORTNAME) AS LSHORTNAME,
  TRIM(AR.DESCRIPTION) AS DESCRIPTION
FROM AT_RELATIONS AR
WHERE (
  UPPER(TRIM(AR.LNAME)) CONTAINING UPPER(:q)
  OR UPPER(TRIM(AR.LSHORTNAME)) CONTAINING UPPER(:q)
  OR UPPER(TRIM(AR.DESCRIPTION)) CONTAINING UPPER(:q)
  OR UPPER(TRIM(AR.RELATIONNAME)) CONTAINING UPPER(:q)
)
AND EXISTS (
  SELECT 1 FROM RDB$RELATIONS R
  WHERE TRIM(R.RDB$RELATION_NAME) = TRIM(AR.RELATIONNAME)
    AND COALESCE(R.RDB$SYSTEM_FLAG, 0) = 0
    AND R.RDB$VIEW_BLR IS NULL
)
ORDER BY AR.LNAME
`;

const DESCRIBE_TABLE_RDB_ONLY_SQL = `
SELECT
  TRIM(RF.RDB$FIELD_NAME) AS FIELD_NAME,
  TRIM(T.RDB$TYPE_NAME) AS FIELD_TYPE,
  F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
  RF.RDB$NULL_FLAG AS NULL_FLAG,
  RF.RDB$FIELD_POSITION AS FIELD_POSITION
FROM RDB$RELATION_FIELDS RF
JOIN RDB$FIELDS F ON F.RDB$FIELD_NAME = RF.RDB$FIELD_SOURCE
LEFT JOIN RDB$TYPES T
  ON T.RDB$TYPE = F.RDB$FIELD_TYPE AND T.RDB$FIELD_NAME = 'RDB$FIELD_TYPE'
WHERE TRIM(RF.RDB$RELATION_NAME) = :tableName
ORDER BY RF.RDB$FIELD_POSITION
`;

const DESCRIBE_TABLE_SQL = `
SELECT
  TRIM(RF.RDB$FIELD_NAME) AS FIELD_NAME,
  TRIM(T.RDB$TYPE_NAME) AS FIELD_TYPE,
  F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
  RF.RDB$NULL_FLAG AS NULL_FLAG,
  RF.RDB$FIELD_POSITION AS FIELD_POSITION,
  TRIM(ARF.LNAME) AS LNAME,
  TRIM(ARF.LSHORTNAME) AS LSHORTNAME,
  TRIM(AF.REFTABLE) AS REF_TABLE,
  TRIM(AF.REFLISTFIELD) AS REF_LIST_FIELD,
  TRIM(AR_REF.LNAME) AS REF_TABLE_LNAME,
  (
    SELECT FIRST 1 TRIM(rc2.rdb$relation_name)
    FROM rdb$relation_fields rf2
    JOIN rdb$relation_constraints rc ON
      rc.rdb$relation_name = rf2.rdb$relation_name
      AND rc.rdb$constraint_type = 'FOREIGN KEY'
    JOIN rdb$index_segments s ON
      s.rdb$index_name = rc.rdb$index_name
      AND s.rdb$field_name = rf2.rdb$field_name
    JOIN rdb$ref_constraints rfc ON
      rfc.rdb$constraint_name = rc.rdb$constraint_name
    JOIN rdb$relation_constraints rc2 ON
      rc2.rdb$constraint_name = rfc.rdb$const_name_uq
    WHERE rf2.rdb$relation_name = RF.RDB$RELATION_NAME
      AND rf2.rdb$field_name = RF.RDB$FIELD_NAME
  ) AS FK_REF_TABLE
FROM RDB$RELATION_FIELDS RF
JOIN RDB$FIELDS F ON F.RDB$FIELD_NAME = RF.RDB$FIELD_SOURCE
LEFT JOIN RDB$TYPES T
  ON T.RDB$TYPE = F.RDB$FIELD_TYPE AND T.RDB$FIELD_NAME = 'RDB$FIELD_TYPE'
LEFT JOIN AT_RELATION_FIELDS ARF
  ON TRIM(ARF.RELATIONNAME) = TRIM(RF.RDB$RELATION_NAME)
  AND TRIM(ARF.FIELDNAME) = TRIM(RF.RDB$FIELD_NAME)
LEFT JOIN AT_FIELDS AF ON TRIM(AF.FIELDNAME) = TRIM(ARF.FIELDSOURCE)
LEFT JOIN AT_RELATIONS AR_REF ON TRIM(AR_REF.RELATIONNAME) = TRIM(AF.REFTABLE)
WHERE TRIM(RF.RDB$RELATION_NAME) = :tableName
ORDER BY RF.RDB$FIELD_POSITION
`;

const TABLE_DISPLAY_NAME_SQL = `
SELECT TRIM(LNAME) AS LNAME, TRIM(LSHORTNAME) AS LSHORTNAME
FROM AT_RELATIONS
WHERE TRIM(RELATIONNAME) = :tableName
`;

const AT_FIELD_LABELS_SQL = `
SELECT
  TRIM(FIELDNAME) AS FIELD_NAME,
  TRIM(LNAME) AS LNAME,
  TRIM(LSHORTNAME) AS LSHORTNAME
FROM AT_RELATION_FIELDS
WHERE TRIM(RELATIONNAME) = :tableName
`;

/** PK/FK field names from Firebird system catalogs (per user schema). */
const TABLE_FIELD_CONSTRAINTS_SQL = `
SELECT
  TRIM(rc.RDB$CONSTRAINT_TYPE) AS CONSTRAINT_TYPE,
  TRIM(sg.RDB$FIELD_NAME) AS FIELD_NAME,
  TRIM(rc.RDB$CONSTRAINT_NAME) AS CONSTRAINT_NAME
FROM RDB$RELATION_CONSTRAINTS rc
JOIN RDB$INDEX_SEGMENTS sg ON rc.RDB$INDEX_NAME = sg.RDB$INDEX_NAME
WHERE TRIM(rc.RDB$RELATION_NAME) = :tableName
  AND rc.RDB$CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY')
`;

function trimLabel(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function pickGedeminLabel(
  lname: unknown,
  lshortname: unknown
): string | null {
  return trimLabel(lname) ?? trimLabel(lshortname);
}

function normalizeFieldKey(key: string): string {
  return key.trim().toUpperCase();
}

function mapTableRow(row: Record<string, unknown>): TableInfo {
  const tableName = String(row.TABLE_NAME ?? '');
  const displayName = pickGedeminLabel(row.LNAME, row.LSHORTNAME);
  const description = trimLabel(row.DESCRIPTION);
  return {
    tableName,
    ...(displayName ? { displayName } : {}),
    ...(description ? { description } : {}),
  };
}

export class SchemaReader implements ISchemaReader {
  private userTableNamesCache: Set<string> | null = null;

  constructor(private readonly executor: IReadQueryExecutor) {}

  async listTables(): Promise<TableInfo[]> {
    try {
      const result = await this.executor.execute(LIST_TABLES_SQL, undefined, {
        applyRowLimit: false,
      });
      return result.rows.map(mapTableRow);
    } catch {
      const result = await this.executor.execute(
        LIST_TABLES_RDB_ONLY_SQL,
        undefined,
        { applyRowLimit: false }
      );
      return result.rows.map((row) => ({
        tableName: String(row.TABLE_NAME ?? row.table_name ?? ''),
      }));
    }
  }

  async searchTables(query: string, limit = DEFAULT_SEARCH_LIMIT): Promise<TableInfo[]> {
    const q = query.trim();
    if (!q) {
      return [];
    }

    try {
      const result = await this.executor.execute(
        SEARCH_TABLES_SQL,
        { q, limit: Math.min(Math.max(limit, 1), 100) },
        { applyRowLimit: false }
      );
      return result.rows.map(mapTableRow);
    } catch {
      const all = await this.listTables();
      const upper = q.toUpperCase();
      return all
        .filter(
          (t) =>
            t.tableName.toUpperCase().includes(upper) ||
            (t.displayName?.toUpperCase().includes(upper) ?? false)
        )
        .slice(0, limit);
    }
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const normalized = tableName.trim().toUpperCase();
    if (!normalized) {
      throw new Error('Table name is required.');
    }

    const params = { tableName: normalized };
    const constraintByField = await this.loadConstraintTypeByField(normalized);

    try {
      const result = await this.executor.execute(
        DESCRIBE_TABLE_SQL,
        params,
        { applyRowLimit: false }
      );
      return this.mapDescribeRows(result.rows, constraintByField);
    } catch {
      const result = await this.executor.execute(
        DESCRIBE_TABLE_RDB_ONLY_SQL,
        params,
        { applyRowLimit: false }
      );
      return this.mapDescribeRows(result.rows, constraintByField);
    }
  }

  async getTableFieldConstraints(
    tableName: string
  ): Promise<TableFieldConstraints> {
    const normalized = tableName.trim().toUpperCase();
    if (!normalized) {
      return {
        tableName: '',
        primaryKey: [],
        foreignKey: [],
        constraints: [],
      };
    }

    try {
      const result = await this.executor.execute(
        TABLE_FIELD_CONSTRAINTS_SQL,
        { tableName: normalized },
        { applyRowLimit: false }
      );

      const primaryKey = new Set<string>();
      const foreignKey = new Set<string>();
      const constraints: TableFieldConstraints['constraints'] = [];

      for (const row of result.rows) {
        const fieldName = String(row.FIELD_NAME ?? '').trim();
        if (!fieldName) {
          continue;
        }
        const rawType = String(row.CONSTRAINT_TYPE ?? '').trim().toUpperCase();
        const constraintType: FieldConstraintType | null =
          rawType === 'PRIMARY KEY'
            ? 'PRIMARY KEY'
            : rawType === 'FOREIGN KEY'
              ? 'FOREIGN KEY'
              : null;
        if (!constraintType) {
          continue;
        }

        const upper = normalizeFieldKey(fieldName);
        if (constraintType === 'PRIMARY KEY') {
          primaryKey.add(upper);
        } else {
          foreignKey.add(upper);
        }

        constraints.push({
          fieldName,
          constraintType,
          constraintName: String(row.CONSTRAINT_NAME ?? '').trim(),
        });
      }

      return {
        tableName: normalized,
        primaryKey: Array.from(primaryKey).sort(),
        foreignKey: Array.from(foreignKey).sort(),
        constraints,
      };
    } catch {
      return {
        tableName: normalized,
        primaryKey: [],
        foreignKey: [],
        constraints: [],
      };
    }
  }

  private async loadConstraintTypeByField(
    tableName: string
  ): Promise<Map<string, FieldConstraintType>> {
    const info = await this.getTableFieldConstraints(tableName);
    const map = new Map<string, FieldConstraintType>();
    for (const row of info.constraints) {
      map.set(normalizeFieldKey(row.fieldName), row.constraintType);
    }
    return map;
  }

  private mapDescribeRows(
    rows: Record<string, unknown>[],
    constraintByField: Map<string, FieldConstraintType>
  ): ColumnInfo[] {
    return rows.map((row) => {
      const fieldName = String(row.FIELD_NAME ?? '');
      const fieldUpper = normalizeFieldKey(fieldName);
      const displayName = pickGedeminLabel(row.LNAME, row.LSHORTNAME);
      const refTable =
        trimLabel(row.REF_TABLE) ?? trimLabel(row.FK_REF_TABLE);
      const refListField = trimLabel(row.REF_LIST_FIELD);
      const refTableDisplayName = pickGedeminLabel(row.REF_TABLE_LNAME, null);
      const constraintType = constraintByField.get(fieldUpper) ?? null;

      return {
        fieldName,
        ...(displayName ? { displayName } : {}),
        fieldType: row.FIELD_TYPE != null ? String(row.FIELD_TYPE) : null,
        fieldLength:
          row.FIELD_LENGTH != null ? Number(row.FIELD_LENGTH) : null,
        nullable: row.NULL_FLAG == null || Number(row.NULL_FLAG) === 0,
        position: Number(row.FIELD_POSITION ?? 0),
        ...(constraintType ? { constraintType } : {}),
        ...(refTable ? { refTable } : {}),
        ...(refListField ? { refListField } : {}),
        ...(refTableDisplayName ? { refTableDisplayName } : {}),
      };
    });
  }

  async getTableDisplayName(tableName: string): Promise<string | null> {
    const normalized = tableName.trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    try {
      const result = await this.executor.execute(
        TABLE_DISPLAY_NAME_SQL,
        { tableName: normalized },
        { applyRowLimit: false }
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return pickGedeminLabel(row.LNAME, row.LSHORTNAME);
    } catch {
      return null;
    }
  }

  async resolveFieldDisplayNames(
    tableName: string,
    fieldNames: string[]
  ): Promise<Record<string, string>> {
    const normalized = tableName.trim().toUpperCase();
    if (!normalized || fieldNames.length === 0) {
      return {};
    }

    const wanted = new Set(
      fieldNames.map((name) => normalizeFieldKey(name)).filter(Boolean)
    );
    if (wanted.size === 0) {
      return {};
    }

    try {
      const result = await this.executor.execute(
        AT_FIELD_LABELS_SQL,
        { tableName: normalized },
        { applyRowLimit: false }
      );

      const labels: Record<string, string> = {};
      for (const row of result.rows) {
        const fieldName = String(row.FIELD_NAME ?? '').trim();
        if (!fieldName) {
          continue;
        }
        const upper = normalizeFieldKey(fieldName);
        if (!wanted.has(upper)) {
          continue;
        }
        const label = pickGedeminLabel(row.LNAME, row.LSHORTNAME);
        if (label) {
          labels[fieldName] = label;
          labels[upper] = label;
        }
      }

      return labels;
    } catch {
      return {};
    }
  }

  async findUnknownTableNames(tableNames: string[]): Promise<string[]> {
    if (tableNames.length === 0) {
      return [];
    }

    if (!this.userTableNamesCache) {
      const tables = await this.listTables();
      this.userTableNamesCache = new Set(
        tables.map((t) => t.tableName.trim().toUpperCase()).filter(Boolean)
      );
    }

    return tableNames.filter(
      (name) => !this.userTableNamesCache!.has(name.trim().toUpperCase())
    );
  }
}
