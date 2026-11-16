import {
  TransactionIsolation,
  type Attachment,
} from 'node-firebird-driver-native';
import {
  buildConnectionString,
  type IFirebirdConfig,
} from '../config/firebird-config';
import type { IFirebirdConnection } from '../ports/IFirebirdConnection';
import {
  assertMinFirebirdEngineMajor,
  parseFirebirdEngineMajor,
} from './firebird-engine-version.js';
import { applyLegacyTypeBinds } from './firebird-session-binds.js';
import { getNativeClient, disposeNativeClient } from './native-client.js';

const ENGINE_VERSION_SQL = `
SELECT TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS engine_version
FROM rdb$database
`;

export class FirebirdConnection implements IFirebirdConnection {
  private attachment: Attachment | undefined;
  private connecting: Promise<Attachment> | undefined;
  private engineChecked = false;
  private engineVersion: string | undefined;
  private legacyBindsApplied = false;

  constructor(private readonly config: IFirebirdConfig) {}

  /** Detected engine version string after a successful connection check. */
  getEngineVersion(): string | undefined {
    return this.engineVersion;
  }

  async getAttachment(): Promise<Attachment> {
    if (this.attachment?.isValid) {
      return this.attachment;
    }

    if (!this.connecting) {
      this.connecting = this.connect();
    }

    try {
      this.attachment = await this.connecting;
      return this.attachment;
    } finally {
      this.connecting = undefined;
    }
  }

  private async connect(): Promise<Attachment> {
    const client = getNativeClient();
    const fullDbName = buildConnectionString(this.config);
    const attachment = await client.connect(fullDbName, {
      username: this.config.username,
      password: this.config.password,
      charSetForNONE: 'utf8',
    });

    try {
      await this.ensureSupportedEngine(attachment);
      await this.ensureLegacyTypeBinds(attachment);
    } catch (error) {
      try {
        await attachment.disconnect();
      } catch {
        /* ignore disconnect after failed version check */
      }
      throw error;
    }

    return attachment;
  }

  private async ensureLegacyTypeBinds(attachment: Attachment): Promise<void> {
    if (this.legacyBindsApplied) return;
    const major =
      parseFirebirdEngineMajor(this.engineVersion ?? '') ??
      this.config.minEngineMajor;
    if (major < 4) {
      this.legacyBindsApplied = true;
      return;
    }
    await applyLegacyTypeBinds(attachment);
    this.legacyBindsApplied = true;
  }

  private async ensureSupportedEngine(attachment: Attachment): Promise<void> {
    if (this.engineChecked && this.engineVersion) {
      assertMinFirebirdEngineMajor(
        this.engineVersion,
        this.config.minEngineMajor
      );
      return;
    }

    const transaction = await attachment.startTransaction({
      isolation: TransactionIsolation.READ_COMMITTED,
      readCommittedMode: 'RECORD_VERSION',
      waitMode: 'NO_WAIT',
      accessMode: 'READ_ONLY',
    });

    try {
      const resultSet = await attachment.executeQuery(
        transaction,
        ENGINE_VERSION_SQL
      );
      try {
        const rows = (await resultSet.fetchAsObject()) as Record<
          string,
          unknown
        >[];
        const raw = rows[0]?.ENGINE_VERSION ?? rows[0]?.engine_version ?? '';
        const version = String(raw ?? '').trim();
        const checked = assertMinFirebirdEngineMajor(
          version,
          this.config.minEngineMajor
        );
        this.engineVersion = checked.version;
        this.engineChecked = true;
      } finally {
        await resultSet.close();
      }
      await transaction.commit();
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (this.attachment?.isValid) {
      try {
        await this.attachment.disconnect();
      } catch (error) {
        console.error('Firebird attachment disconnect failed:', error);
      }
    }
    this.attachment = undefined;
    this.engineChecked = false;
    this.engineVersion = undefined;
    this.legacyBindsApplied = false;
    await disposeNativeClient();
  }
}
