import type { Attachment } from 'node-firebird-driver-native';

export interface IFirebirdConnection {
  getAttachment(): Promise<Attachment>;
  dispose(): Promise<void>;
}
