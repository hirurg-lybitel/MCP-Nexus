import type { Attachment } from 'node-firebird-driver-native';
import {
  buildConnectionString,
  type IFirebirdConfig,
} from '../config/firebird-config';
import type { IFirebirdConnection } from '../ports/IFirebirdConnection';
import { getNativeClient, disposeNativeClient } from './native-client';

export class FirebirdConnection implements IFirebirdConnection {
  private attachment: Attachment | undefined;
  private connecting: Promise<Attachment> | undefined;

  constructor(private readonly config: IFirebirdConfig) {}

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
    return client.connect(fullDbName, {
      username: this.config.username,
      password: this.config.password,
    });
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
    await disposeNativeClient();
  }
}
