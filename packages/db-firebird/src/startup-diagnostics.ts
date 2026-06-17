import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getDefaultLibraryFilename } from 'node-firebird-driver-native';
import { getNativeClient } from './infrastructure/native-client';

export interface LibfbclientDiskReport {
  soPath: string | null;
  so2Path: string | null;
  allPaths: string[];
  missingSymlink: boolean;
}

/** Scan /usr/lib/* for libfbclient.so* (Debian libfbclient2 layout). */
export function inspectLibfbclientOnDisk(usrLib = '/usr/lib'): LibfbclientDiskReport {
  const allPaths: string[] = [];
  let soPath: string | null = null;
  let so2Path: string | null = null;

  if (!existsSync(usrLib)) {
    return { soPath, so2Path, allPaths, missingSymlink: true };
  }

  for (const archDir of readdirSync(usrLib)) {
    const archPath = join(usrLib, archDir);
    try {
      if (!statSync(archPath).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    let entries: string[];
    try {
      entries = readdirSync(archPath);
    } catch {
      continue;
    }

    for (const name of entries) {
      if (!name.startsWith('libfbclient.so')) {
        continue;
      }
      const fullPath = join(archPath, name);
      allPaths.push(fullPath);
      if (name === 'libfbclient.so') {
        soPath = fullPath;
      } else if (name === 'libfbclient.so.2') {
        so2Path = fullPath;
      }
    }
  }

  return {
    soPath,
    so2Path,
    allPaths,
    missingSymlink: !soPath && so2Path !== null,
  };
}

export interface FirebirdNativeProbeResult {
  ok: boolean;
  libraryFilename: string;
  disk: LibfbclientDiskReport;
  errorMessage?: string;
}

/** Disk symlink check + load native client library (no DB connection). */
export function probeFirebirdNativeClient(): FirebirdNativeProbeResult {
  const libraryFilename = getDefaultLibraryFilename();
  const disk = inspectLibfbclientOnDisk();

  try {
    const client = getNativeClient();
    if (!client.isValid) {
      return {
        ok: false,
        libraryFilename,
        disk,
        errorMessage: 'Native client is not valid',
      };
    }
    return { ok: true, libraryFilename, disk };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { ok: false, libraryFilename, disk, errorMessage };
  }
}
