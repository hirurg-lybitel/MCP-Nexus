import { isIdentifierColumn } from './column-picker';
import type { DescribeColumnInfo } from './firebird-tools';

export type SchemaColumnGroup = 'identifiers' | 'references' | 'business' | 'sensitive';

export interface GroupedSchemaColumns {
  identifiers: DescribeColumnInfo[];
  references: DescribeColumnInfo[];
  business: DescribeColumnInfo[];
  sensitive: DescribeColumnInfo[];
}

function classifyColumn(col: DescribeColumnInfo): SchemaColumnGroup {
  if (col.sensitive) {
    return 'sensitive';
  }
  if (col.refTable?.trim()) {
    return 'references';
  }
  if (isIdentifierColumn(col.fieldName)) {
    return 'identifiers';
  }
  return 'business';
}

export function groupSchemaColumns(
  columns: DescribeColumnInfo[]
): GroupedSchemaColumns {
  const groups: GroupedSchemaColumns = {
    identifiers: [],
    references: [],
    business: [],
    sensitive: [],
  };

  for (const col of columns) {
    groups[classifyColumn(col)].push(col);
  }

  return groups;
}

export function schemaGroupOrder(): SchemaColumnGroup[] {
  return ['business', 'references', 'identifiers', 'sensitive'];
}
