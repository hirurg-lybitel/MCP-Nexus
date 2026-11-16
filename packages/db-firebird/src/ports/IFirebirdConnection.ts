import type { Attachment } from 'node-firebird-driver-native';

export interface IFirebirdConnection {
  getAttachment(): Promise<Attachment>;
  /** Present after a successful engine gate on connect. */
  getEngineVersion?(): string | undefined;
  dispose(): Promise<void>;
}
