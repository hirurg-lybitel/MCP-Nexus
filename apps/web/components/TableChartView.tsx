'use client';

import { useMemo } from 'react';
import type { TableColumn } from '@/types';
import {
  chartValueToNumber,
  type ChartSpec,
} from '@/lib/chat/table-chart-detect';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { localeToBcp47 } from '@/lib/i18n/types';

interface TableChartViewProps {
  spec: Extract<ChartSpec, { chartable: true }>;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

const BAR_HEIGHT = 28;
const BAR_GAP = 6;
const LABEL_WIDTH = 120;
const CHART_PADDING = 8;

export default function TableChartView({
  spec,
  columns,
  rows,
}: TableChartViewProps) {
  const locale = useLocaleStore((s) => s.locale);
  const bcp47 = localeToBcp47(locale);

  const labelCol = spec.labelKey
    ? columns.find((c) => c.key === spec.labelKey)
    : undefined;
  const valueCol = columns.find((c) => c.key === spec.valueKey);

  const points = useMemo(() => {
    return rows.map((row, index) => {
      const rawLabel = spec.labelKey
        ? row[spec.labelKey]
        : spec.useRowIndex
          ? String(index + 1)
          : '';
      const label =
        rawLabel == null || rawLabel === ''
          ? `#${index + 1}`
          : String(rawLabel);
      const value = chartValueToNumber(row[spec.valueKey]);
      return { label, value: Number.isFinite(value) ? value : 0 };
    });
  }, [rows, spec.labelKey, spec.useRowIndex, spec.valueKey]);

  const maxValue = Math.max(...points.map((p) => p.value), 0);
  const chartHeight =
    points.length * BAR_HEIGHT + Math.max(0, points.length - 1) * BAR_GAP;

  const numberFmt = useMemo(
    () =>
      new Intl.NumberFormat(bcp47, {
        maximumFractionDigits: 2,
      }),
    [bcp47]
  );

  if (points.length === 0 || maxValue <= 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto max-w-full min-w-0 rounded-lg border border-gray-600/80 bg-gray-900/60 p-3">
      <svg
        role="img"
        aria-label={valueCol?.label ?? spec.valueKey}
        width="100%"
        height={chartHeight + CHART_PADDING * 2}
        viewBox={`0 0 640 ${chartHeight + CHART_PADDING * 2}`}
        preserveAspectRatio="xMinYMid meet"
        className="min-w-[20rem]"
      >
        {points.map((point, index) => {
          const y =
            CHART_PADDING + index * (BAR_HEIGHT + BAR_GAP);
          const barMaxWidth = 640 - LABEL_WIDTH - 56;
          const barWidth =
            maxValue > 0 ? (point.value / maxValue) * barMaxWidth : 0;

          return (
            <g key={`${point.label}-${index}`}>
              <text
                x={0}
                y={y + BAR_HEIGHT / 2}
                dominantBaseline="middle"
                className="fill-gray-400 text-[11px]"
                style={{ fontSize: 11 }}
              >
                {truncateLabel(point.label, 18)}
              </text>
              <rect
                x={LABEL_WIDTH}
                y={y}
                width={Math.max(barWidth, point.value > 0 ? 2 : 0)}
                height={BAR_HEIGHT}
                rx={3}
                className="fill-emerald-500/80"
              />
              <text
                x={LABEL_WIDTH + barWidth + 6}
                y={y + BAR_HEIGHT / 2}
                dominantBaseline="middle"
                className="fill-gray-200 text-[11px] tabular-nums"
                style={{ fontSize: 11 }}
              >
                {numberFmt.format(point.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {valueCol && (
        <p className="mt-2 text-[11px] text-gray-500 text-right">
          {valueCol.label}
        </p>
      )}
    </div>
  );
}

function truncateLabel(label: string, max: number): string {
  if (label.length <= max) {
    return label;
  }
  return `${label.slice(0, max - 1)}…`;
}
