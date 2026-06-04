'use client';

import { useState } from 'react';
import { ChevronDown, Zap } from 'lucide-react';

function prettifyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function formatToolLabel(toolName: string): string {
  return toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ToolCallPanelProps {
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
}

export default function ToolCallPanel({
  toolName,
  toolInput,
  toolResult,
}: ToolCallPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (toolInput && Object.keys(toolInput).length > 0) ||
    Boolean(toolResult?.trim());

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2 text-left ${
          hasDetails ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
        }`}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <Zap className="w-4 h-4 shrink-0 text-yellow-400" />
        <span className="text-xs font-semibold text-yellow-400 flex-1 min-w-0 truncate">
          Using: {formatToolLabel(toolName)}
        </span>
        {hasDetails && (
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-yellow-400/80 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {hasDetails && expanded && (
        <div className="mt-2 space-y-2 rounded-md border border-gray-600/80 bg-gray-900/70 p-2.5 text-xs min-w-0">
          {toolInput && Object.keys(toolInput).length > 0 && (
            <div className="space-y-1 min-w-0">
              <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">
                Input
              </span>
              <pre className="overflow-x-auto max-h-48 rounded bg-gray-950/80 p-2 text-gray-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                {prettifyJson(JSON.stringify(toolInput))}
              </pre>
            </div>
          )}
          {toolResult?.trim() && (
            <div className="space-y-1 min-w-0">
              <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">
                Result
              </span>
              <pre className="overflow-x-auto max-h-64 rounded bg-gray-950/80 p-2 text-gray-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                {prettifyJson(toolResult)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
