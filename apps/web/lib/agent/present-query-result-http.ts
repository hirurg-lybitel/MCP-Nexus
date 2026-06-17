import type { IncomingMessage, ServerResponse } from 'node:http';
import { handlePresentQueryResultPost } from './present-query-result-handler';

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function writePresentQueryResultHttp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (req.method !== 'POST') {
    return false;
  }

  const host = req.headers.host ?? 'localhost';
  const url = `http://${host}${req.url ?? '/api/agent/present-query-result'}`;
  const body = await readRequestBody(req);

  const request = new Request(url, {
    method: 'POST',
    headers: req.headers as HeadersInit,
    body: body.length > 0 ? new Uint8Array(body) : undefined,
  });

  const response = await handlePresentQueryResultPost(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
}
