import {
  getDbServices,
  loadFirebirdConfig,
  probeFirebirdNativeClient,
} from '@mcp-nexus/db-firebird';

const PREFIX = '[startup]';

export function logStartupDiagnostics(): void {
  const probe = probeFirebirdNativeClient();
  const { disk } = probe;

  if (disk.soPath) {
    console.log(`${PREFIX} Firebird libfbclient.so: found at ${disk.soPath}`);
  } else if (disk.so2Path) {
    console.warn(
      `${PREFIX} Firebird libfbclient.so: MISSING symlink (found libfbclient.so.2 at: ${disk.so2Path})`
    );
  } else if (disk.allPaths.length > 0) {
    console.warn(
      `${PREFIX} Firebird libfbclient.so: MISSING (found: ${disk.allPaths.join(', ')})`
    );
  } else {
    console.warn(
      `${PREFIX} Firebird libfbclient.so: not found under /usr/lib (install libfbclient2)`
    );
  }

  if (probe.ok) {
    console.log(
      `${PREFIX} Firebird native client: OK (library=${probe.libraryFilename})`
    );
  } else {
    console.error(
      `${PREFIX} Firebird native client: FAILED${probe.errorMessage ? ` — ${probe.errorMessage}` : ''}`
    );
  }

  const config = loadFirebirdConfig();
  if (!config) {
    console.warn(
      `${PREFIX} Firebird MCP tools: disabled (set NODE_FB_* and ISC_* in .env)`
    );
    return;
  }

  const dbServices = getDbServices();
  if (dbServices && probe.ok) {
    console.log(`${PREFIX} Firebird MCP tools: enabled`);
  } else if (dbServices) {
    console.warn(
      `${PREFIX} Firebird MCP tools: config present but native client unavailable`
    );
  }
}
