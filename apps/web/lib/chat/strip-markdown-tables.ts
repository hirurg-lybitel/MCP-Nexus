import type { Locale } from '@/lib/i18n/types';
import { DEFAULT_LOCALE } from '@/lib/i18n/types';
import { translate } from '@/lib/i18n/get-messages';

/**
 * Removes GFM pipe tables from assistant text when rows are already shown
 * via present_query_result (Claude Brief pattern — no duplicate table in prose).
 */
export function stripMarkdownTables(
  text: string,
  locale: Locale = DEFAULT_LOCALE
): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inTable = false;
  let skippedTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isPipeRow = trimmed.startsWith('|');
    const isSeparator =
      inTable && /^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes('-');

    if (isPipeRow || isSeparator) {
      inTable = true;
      skippedTable = true;
      continue;
    }

    if (inTable) {
      inTable = false;
      if (trimmed === '') {
        continue;
      }
    }

    out.push(line);
  }

  const result = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (skippedTable && result.length === 0) {
    return translate(locale, 'chat.tableAboveFallback');
  }

  return result;
}

/** True when this message is assistant prose right after present_query_result in the same turn. */
export function shouldStripTablesAfterPresentation(
  messages: Array<{ role: string; tableData?: unknown; toolName?: string; content?: string }>,
  index: number
): boolean {
  const msg = messages[index];
  if (!msg || msg.role !== 'assistant' || msg.tableData || msg.toolName) {
    return false;
  }
  if (!msg.content?.trim()) {
    return false;
  }

  let lastTableIdx = -1;
  for (let i = 0; i < index; i++) {
    if (messages[i]?.tableData) {
      lastTableIdx = i;
    }
  }
  if (lastTableIdx < 0) {
    return false;
  }

  for (let i = lastTableIdx + 1; i < index; i++) {
    if (messages[i]?.role === 'user') {
      return false;
    }
  }

  return true;
}
