'use client';

import { formatCostUsd } from '@/lib/chat/model-pricing';
import type { TurnUsageMeta } from '@/lib/chat/turn-usage';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { localeToBcp47 } from '@/lib/i18n/types';

function formatTokenCount(value: number, locale: string): string {
  return value.toLocaleString(locale).replaceAll(',', ' ');
}

export function formatTurnUsageLine(meta: TurnUsageMeta, locale: string): string {
  const { usage, estimatedCostUsd } = meta;
  return `≈ ${formatCostUsd(estimatedCostUsd)} in/out ${formatTokenCount(usage.promptTokens, locale)}/${formatTokenCount(usage.completionTokens, locale)}`;
}

interface TurnUsageFooterProps {
  meta: TurnUsageMeta;
}

export default function TurnUsageFooter({ meta }: TurnUsageFooterProps) {
  const locale = useLocaleStore((s) => s.locale);
  const bcp47 = localeToBcp47(locale);

  return (
    <span
      className="text-xs opacity-60 mt-1 block font-mono"
      title={meta.pricingNote}
    >
      {formatTurnUsageLine(meta, bcp47)}
    </span>
  );
}
