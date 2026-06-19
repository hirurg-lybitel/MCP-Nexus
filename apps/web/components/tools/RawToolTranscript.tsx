'use client';

function prettifyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

interface RawToolTranscriptProps {
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  inputLabel: string;
  resultLabel: string;
  sectionLabel: string;
}

export default function RawToolTranscript({
  toolInput,
  toolResult,
  inputLabel,
  resultLabel,
  sectionLabel,
}: RawToolTranscriptProps) {
  const hasInput = toolInput && Object.keys(toolInput).length > 0;
  const hasResult = Boolean(toolResult?.trim());

  if (!hasInput && !hasResult) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-600/60 space-y-2 min-w-0">
      <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">
        {sectionLabel}
      </span>
      {hasInput && (
        <div className="space-y-1 min-w-0">
          <span className="text-gray-500 font-medium uppercase tracking-wide text-[10px]">
            {inputLabel}
          </span>
          <pre className="overflow-x-auto max-h-48 rounded bg-gray-950/80 p-2 text-gray-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {prettifyJson(JSON.stringify(toolInput))}
          </pre>
        </div>
      )}
      {hasResult && (
        <div className="space-y-1 min-w-0">
          <span className="text-gray-500 font-medium uppercase tracking-wide text-[10px]">
            {resultLabel}
          </span>
          <pre className="overflow-x-auto max-h-64 rounded bg-gray-950/80 p-2 text-gray-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {prettifyJson(toolResult!)}
          </pre>
        </div>
      )}
    </div>
  );
}
