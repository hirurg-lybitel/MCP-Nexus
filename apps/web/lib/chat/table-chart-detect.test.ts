import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectChartSpec } from './table-chart-detect';

describe('detectChartSpec', () => {
  const categoryQtyColumns = [
    { key: 'STATUS', label: 'Status' },
    { key: 'CNT', label: 'Count' },
  ];

  it('detects category + numeric columns', () => {
    const rows = [
      { STATUS: 'Open', CNT: 12 },
      { STATUS: 'Closed', CNT: 8 },
      { STATUS: 'Pending', CNT: 5 },
    ];
    const spec = detectChartSpec(categoryQtyColumns, rows);
    assert.equal(spec.chartable, true);
    if (spec.chartable) {
      assert.equal(spec.labelKey, 'STATUS');
      assert.equal(spec.valueKey, 'CNT');
      assert.equal(spec.chartType, 'bar');
    }
  });

  it('uses row index when no label column fits', () => {
    const rows = [
      { VALUE: 10 },
      { VALUE: 20 },
    ];
    const spec = detectChartSpec([{ key: 'VALUE', label: 'Value' }], rows);
    assert.equal(spec.chartable, true);
    if (spec.chartable) {
      assert.equal(spec.valueKey, 'VALUE');
      assert.equal(spec.useRowIndex, true);
    }
  });

  it('returns not chartable for all-text rows', () => {
    const rows = [
      { NAME: 'Alice', CITY: 'Minsk' },
      { NAME: 'Bob', CITY: 'Gomel' },
    ];
    const spec = detectChartSpec(
      [
        { key: 'NAME', label: 'Name' },
        { key: 'CITY', label: 'City' },
      ],
      rows
    );
    assert.equal(spec.chartable, false);
  });

  it('returns not chartable for too few rows', () => {
    const spec = detectChartSpec(categoryQtyColumns, [
      { STATUS: 'Open', CNT: 1 },
    ]);
    assert.equal(spec.chartable, false);
  });
});
