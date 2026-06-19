import { AgentToolName } from '@/lib/agent/tool-names';
import type { TableDisplayData } from '@/types';
import { labelForColumn, normalizeColumnLabels } from './column-labels';
import { buildDisplayTableFromRows } from './column-picker';
import { normalizeTableKeyFields } from './table-key-fields';

export { isSilentFirebirdToolUi, shouldShowToolCallPanel } from './tool-ui';

/** Host agent tool — renders the chat data table. */
export const AGENT_PRESENT_TABLE_TOOL = AgentToolName.PresentQueryResult;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseTableFromToolResult(
  toolName: string,
  resultText: string
): TableDisplayData | null {
  if (toolName !== AGENT_PRESENT_TABLE_TOOL) {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(resultText);
  } catch {
    return null;
  }

  const record = asRecord(data);
  if (!record || record.error) {
    return null;
  }

  const rows = record.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const rowObjects = rows
    .map(asRecord)
    .filter((r): r is Record<string, unknown> => r !== null);

  if (rowObjects.length === 0) {
    return null;
  }

  const columnLabels = normalizeColumnLabels(record.columnLabels);
  const keyFields = normalizeTableKeyFields(record.keyFields);
  const built = buildDisplayTableFromRows(rowObjects, { keyFields });

  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim()
      : 'Query result';

  const columns = built.columns.map((key) => ({
    key,
    label: labelForColumn(key, columnLabels),
  }));

  return {
    title,
    columns,
    rows: built.rows,
    meta: {
      rowCount:
        typeof record.rowCount === 'number'
          ? record.rowCount
          : rowObjects.length,
      truncated: Boolean(record.truncated),
      hiddenColumnCount: built.hiddenColumnCount,
      allColumnCount: built.allColumnCount,
    },
  };
}
