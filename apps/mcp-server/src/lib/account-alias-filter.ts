/**
 * Filters for trial-balance account selection by alias prefix / numeric range.
 * Examples: ["50","51","60"] or ["50-62"].
 */

export function normalizeAliasToken(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

/** Leading account number: 62.4-1 → 62, 51-15 → 51, 90 → 90. */
export function parseAliasRoot(alias: string): number | null {
  const m = /^(\d+)/.exec(String(alias ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export type AliasFilterToken =
  | { kind: 'prefix'; value: string }
  | { kind: 'range'; from: number; to: number };

export function parseAliasFilterToken(raw: string): AliasFilterToken | null {
  const token = normalizeAliasToken(raw);
  if (!token) return null;
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(token);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return from <= to
      ? { kind: 'range', from, to }
      : { kind: 'range', from: to, to: from };
  }
  return { kind: 'prefix', value: token };
}

export function parseAliasFilterTokens(
  raw: string[] | undefined | null
): AliasFilterToken[] {
  if (!raw?.length) return [];
  const out: AliasFilterToken[] = [];
  for (const item of raw) {
    const parsed = parseAliasFilterToken(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function aliasMatchesPrefix(alias: string, prefix: string): boolean {
  const a = normalizeAliasToken(alias);
  const p = normalizeAliasToken(prefix);
  if (!a || !p) return false;
  if (a === p) return true;
  return a.startsWith(`${p}.`) || a.startsWith(`${p}-`);
}

export function aliasMatchesFilter(
  alias: string,
  tokens: AliasFilterToken[]
): boolean {
  if (!tokens.length) return true;
  const root = parseAliasRoot(alias);
  for (const token of tokens) {
    if (token.kind === 'prefix') {
      if (aliasMatchesPrefix(alias, token.value)) return true;
    } else if (root != null && root >= token.from && root <= token.to) {
      return true;
    }
  }
  return false;
}

export function rowAlias(row: Record<string, unknown>): string {
  const raw =
    row.ACCOUNT_ALIAS ??
    row.account_alias ??
    row.ALIAS ??
    row.alias ??
    '';
  return String(raw ?? '');
}

export function rowOffbalance(row: Record<string, unknown>): number {
  const raw =
    row.OFFBALANCE ?? row.offbalance ?? row.OffBalance ?? 0;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  const n = typeof raw === 'bigint' ? Number(raw) : Number(raw);
  return Number.isFinite(n) && n !== 0 ? 1 : 0;
}
