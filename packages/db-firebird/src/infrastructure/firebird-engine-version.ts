import { FirebirdUnsupportedEngineError } from '../domain/errors.js';
import { DEFAULT_MIN_FIREBIRD_ENGINE_MAJOR } from '../config/firebird-engine-policy.js';

export { FirebirdUnsupportedEngineError, DEFAULT_MIN_FIREBIRD_ENGINE_MAJOR };

/**
 * Parse Firebird ENGINE_VERSION strings like "5.0.4", "WI-V2.5.9.27139", "LI-V5.0.0".
 */
export function parseFirebirdEngineMajor(version: string): number | null {
  const trimmed = version.trim();
  if (!trimmed) return null;

  const prefixed = /(?:WI|LI|WI-T|LI-T)-V?(\d+)\./i.exec(trimmed);
  if (prefixed) {
    const major = Number.parseInt(prefixed[1]!, 10);
    return Number.isFinite(major) ? major : null;
  }

  const plain = /^(\d+)\./.exec(trimmed);
  if (plain) {
    const major = Number.parseInt(plain[1]!, 10);
    return Number.isFinite(major) ? major : null;
  }

  const any = /(\d+)\.\d+/.exec(trimmed);
  if (any) {
    const major = Number.parseInt(any[1]!, 10);
    return Number.isFinite(major) ? major : null;
  }

  return null;
}

export function assertMinFirebirdEngineMajor(
  versionRaw: string,
  minMajor: number = DEFAULT_MIN_FIREBIRD_ENGINE_MAJOR
): { major: number; version: string } {
  const version = versionRaw.trim();
  const major = parseFirebirdEngineMajor(version);
  if (major == null) {
    throw new FirebirdUnsupportedEngineError(
      `Cannot determine Firebird engine version from "${version}". ` +
        `MCP Nexus requires Firebird ${minMajor}.0 or newer.`
    );
  }
  if (major < minMajor) {
    throw new FirebirdUnsupportedEngineError(
      `Firebird ${major} is not supported (connected: ${version}). ` +
        `Upgrade the database to Firebird ${minMajor}.0. ` +
        `Firebird 2.5 is not a supported runtime for MCP Nexus.`
    );
  }
  return { major, version };
}
