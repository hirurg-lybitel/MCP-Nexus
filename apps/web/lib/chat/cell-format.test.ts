import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellKindFromFieldType,
  formatCellPlainText,
  isForeignKeyColumn,
  resolveCellKind,
  resolveDisplayKind,
} from './cell-format';

describe('cellKindFromFieldType', () => {
  it('maps Firebird integer types', () => {
    assert.equal(cellKindFromFieldType('INTEGER'), 'integer');
    assert.equal(cellKindFromFieldType('BIGINT'), 'integer');
  });

  it('maps Firebird decimal and date types', () => {
    assert.equal(cellKindFromFieldType('DOUBLE'), 'decimal');
    assert.equal(cellKindFromFieldType('DATE'), 'date');
    assert.equal(cellKindFromFieldType('TIMESTAMP'), 'datetime');
  });
});

describe('resolveCellKind', () => {
  it('prefers schema fieldType over value shape', () => {
    assert.equal(
      resolveCellKind('12345', 'NAME', { fieldType: 'VARCHAR' }),
      'text'
    );
  });

  it('uses schema for numeric columns', () => {
    assert.equal(
      resolveCellKind('42', 'QTY', { fieldType: 'INTEGER' }),
      'integer'
    );
  });

  it('falls back to value inference without meta', () => {
    assert.equal(resolveCellKind(true, 'ACTIVE'), 'boolean');
    assert.equal(resolveCellKind(12.5, 'AMOUNT'), 'decimal');
    assert.equal(resolveCellKind('2024-03-15', 'CREATED'), 'date');
  });

  it('returns null for empty values', () => {
    assert.equal(resolveCellKind(null, 'NAME'), 'null');
    assert.equal(resolveCellKind('', 'NAME'), 'null');
  });
});

describe('resolveDisplayKind', () => {
  const tsValue = '2025-01-22T22:49:00';

  it('narrows TIMESTAMP to date-only from Russian label', () => {
    assert.equal(
      resolveDisplayKind(tsValue, 'DOC_DATE', { fieldType: 'TIMESTAMP' }, 'Дата документа'),
      'date'
    );
    const formatted = formatCellPlainText(
      tsValue,
      resolveDisplayKind(tsValue, 'DOC_DATE', { fieldType: 'TIMESTAMP' }, 'Дата документа'),
      'ru'
    );
    assert.doesNotMatch(formatted, /22:49/);
  });

  it('narrows TIMESTAMP to time-only from Russian label', () => {
    assert.equal(
      resolveDisplayKind(tsValue, 'CREATED', { fieldType: 'TIMESTAMP' }, 'Время создания'),
      'time'
    );
    const formatted = formatCellPlainText(
      tsValue,
      resolveDisplayKind(tsValue, 'CREATED', { fieldType: 'TIMESTAMP' }, 'Время создания'),
      'ru'
    );
    assert.match(formatted, /22:49/);
    assert.doesNotMatch(formatted, /2025/);
  });

  it('keeps datetime when label mentions both date and time', () => {
    assert.equal(
      resolveDisplayKind(tsValue, 'STAMP', { fieldType: 'TIMESTAMP' }, 'Дата и время'),
      'datetime'
    );
  });
});

describe('formatCellPlainText', () => {
  it('formats null and boolean', () => {
    assert.equal(formatCellPlainText(null, 'null', 'en'), '—');
    assert.equal(formatCellPlainText(true, 'boolean', 'en'), 'yes');
    assert.equal(formatCellPlainText(false, 'boolean', 'en'), 'no');
  });

  it('formats numbers with locale grouping', () => {
    const formatted = formatCellPlainText(1234567, 'integer', 'en');
    assert.match(formatted, /1,234,567|1 234 567/);
  });
});

describe('isForeignKeyColumn', () => {
  it('detects refTable metadata', () => {
    assert.equal(
      isForeignKeyColumn('GROUPKEY', { refTable: 'GD_GOODGROUP' }),
      true
    );
  });

  it('detects keyFields foreign keys', () => {
    assert.equal(
      isForeignKeyColumn(
        'GROUPKEY',
        undefined,
        { primaryKey: [], foreignKey: ['GROUPKEY'] }
      ),
      true
    );
  });
});
