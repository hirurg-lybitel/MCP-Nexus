/**
 * Heuristic: after a blocking modal (P1), Gedemin often returns ok + empty rows
 * instead of an error. Reject that only when a block was seen recently.
 */

export function isEmptyOkReport(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.ok === false) return false;
  if (typeof d.error === 'string' && d.error.length > 0) return false;

  if (typeof d.rowCount === 'number' && d.rowCount === 0) return true;

  for (const key of ['rows', 'entries', 'accounts', 'configs'] as const) {
    const value = d[key];
    if (Array.isArray(value) && value.length === 0) return true;
  }

  return false;
}
