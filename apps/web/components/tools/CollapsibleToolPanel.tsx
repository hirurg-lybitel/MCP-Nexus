'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Zap } from 'lucide-react';
import RawToolTranscript from './RawToolTranscript';

interface CollapsibleToolPanelProps {
  title: string;
  summary: ReactNode;
  defaultExpanded?: boolean;
  children?: ReactNode;
  /** When false, panel is not expandable (summary only). */
  expandable?: boolean;
  developerMode?: boolean;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  rawSectionLabel?: string;
  rawInputLabel?: string;
  rawResultLabel?: string;
}

export default function CollapsibleToolPanel({
  title,
  summary,
  defaultExpanded = false,
  children,
  expandable = true,
  developerMode = false,
  toolInput,
  toolResult,
  rawSectionLabel = 'Raw transcript',
  rawInputLabel = 'Input',
  rawResultLabel = 'Result',
}: CollapsibleToolPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasStructuredDetails = expandable && Boolean(children);
  const hasRawTranscript =
    developerMode &&
    ((toolInput && Object.keys(toolInput).length > 0) ||
      Boolean(toolResult?.trim()));
  const hasDetails = hasStructuredDetails || hasRawTranscript;

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className={`flex w-full items-start gap-2 text-left ${
          hasDetails ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
        }`}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <Zap className="w-4 h-4 shrink-0 text-yellow-400 mt-0.5" />
        <span className="flex-1 min-w-0 space-y-0.5">
          <span className="block text-xs font-semibold text-yellow-400 truncate">
            {title}
          </span>
          <span className="block text-xs text-gray-300 leading-relaxed">
            {summary}
          </span>
        </span>
        {hasDetails && (
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-yellow-400/80 transition-transform mt-0.5 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {hasDetails && expanded && (
        <div className="mt-2 ml-6 rounded-md border border-gray-600/80 bg-gray-900/70 p-2.5 text-xs min-w-0">
          {hasStructuredDetails && children}
          {hasRawTranscript && (
            <RawToolTranscript
              toolInput={toolInput}
              toolResult={toolResult}
              sectionLabel={rawSectionLabel}
              inputLabel={rawInputLabel}
              resultLabel={rawResultLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}
