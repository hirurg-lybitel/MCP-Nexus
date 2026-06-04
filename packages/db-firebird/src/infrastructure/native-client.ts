import {
  Client,
  createNativeClient,
  getDefaultLibraryFilename,
} from 'node-firebird-driver-native';

let client: Client | undefined;

export function getNativeClient(): Client {
  if (!client?.isValid) {
    client = createNativeClient(getDefaultLibraryFilename());
  }
  return client;
}

export async function disposeNativeClient(): Promise<void> {
  if (client?.isValid) {
    await client.dispose();
  }
  client = undefined;
}
