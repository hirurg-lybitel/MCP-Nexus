import { formatCostUsd } from '@/lib/chat/model-pricing';
import type { TurnUsageMeta } from '@/lib/chat/turn-usage';

function formatTokenCount(value: number): string {
  return value.toLocaleString('en-US').replaceAll(',', ' ');
}

export function formatTurnUsageLine(meta: TurnUsageMeta): string {
  const { usage, estimatedCostUsd } = meta;
  return `≈ ${formatCostUsd(estimatedCostUsd)} in/out ${formatTokenCount(usage.promptTokens)}/${formatTokenCount(usage.completionTokens)}`;
}

interface TurnUsageFooterProps {
  meta: TurnUsageMeta;
}

export default function TurnUsageFooter({ meta }: TurnUsageFooterProps) {
  return (
    <span
      className="text-xs opacity-60 mt-1 block font-mono"
      title={meta.pricingNote}
    >
      {formatTurnUsageLine(meta)}
    </span>
  );
}
