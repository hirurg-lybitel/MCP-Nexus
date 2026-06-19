import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportFilename,
  formatExportCell,
  serializeTableToCsv,
  serializeTableToTsv,
} from './table-export';
import type { TableDisplayData } from '@/types';

const sampleTable: TableDisplayData = {
  title: 'Группы ТМЦ',
  columns: [
    { key: 'NAME', label: 'Группа товаров' },
    { key: 'COUNT', label: 'Количество товаров' },
  ],
  rows: [
    { NAME: 'Материалы', COUNT: 551 },
    { NAME: '2. Программы', COUNT: 302 },
  ],
};

describe('formatExportCell', () => {
  it('matches display formatting for common types', () => {
    assert.equal(formatExportCell(null), '—');
    assert.equal(formatExportCell(true), 'yes');
    assert.equal(formatExportCell(false), 'no');
    assert.equal(formatExportCell(42), '42');
    assert.equal(formatExportCell({ a: 1 }), '{"a":1}');
  });
});

describe('serializeTableToCsv', () => {
  it('uses human-readable column labels as header', () => {
    const csv = serializeTableToCsv(sampleTable);
    assert.match(csv, /^Группа товаров,Количество товаров/);
    assert.match(csv, /Материалы,551/);
  });

  it('escapes fields containing commas and quotes', () => {
    const csv = serializeTableToCsv({
      columns: [{ key: 'NAME', label: 'Name' }],
      rows: [{ NAME: 'A, "quoted"' }],
    });
    assert.equal(csv, 'Name\r\n"A, ""quoted"""');
  });
});

describe('serializeTableToTsv', () => {
  it('uses tab delimiter', () => {
    const tsv = serializeTableToTsv(sampleTable);
    assert.match(tsv, /^Группа товаров\tКоличество товаров/);
    assert.match(tsv, /Материалы\t551/);
  });
});

describe('buildExportFilename', () => {
  it('sanitizes title and appends date', () => {
    const name = buildExportFilename('Группы ТМЦ');
    assert.match(name, /^Группы_ТМЦ_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('falls back when title is empty', () => {
    assert.match(buildExportFilename(undefined), /^query_result_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
