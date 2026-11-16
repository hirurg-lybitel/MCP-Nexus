/** Shared “worker just hit a blocking dialog” flag for empty-report rejection. */

let lastBlockAt: number | null = null;

export function markWorkerBlocked(at: number = Date.now()): void {
  lastBlockAt = at;
}

export function clearWorkerBlocked(): void {
  lastBlockAt = null;
}

export function getLastWorkerBlockAt(): number | null {
  return lastBlockAt;
}

export function wasWorkerBlockedRecently(
  windowMs = 15_000,
  now: number = Date.now()
): boolean {
  return lastBlockAt != null && now - lastBlockAt < windowMs;
}
