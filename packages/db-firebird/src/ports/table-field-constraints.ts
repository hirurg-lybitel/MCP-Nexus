export type FieldConstraintType = 'PRIMARY KEY' | 'FOREIGN KEY';

export interface TableFieldConstraintRow {
  fieldName: string;
  constraintType: FieldConstraintType;
  constraintName: string;
}

export interface TableFieldConstraints {
  tableName: string;
  primaryKey: string[];
  foreignKey: string[];
  constraints: TableFieldConstraintRow[];
}
