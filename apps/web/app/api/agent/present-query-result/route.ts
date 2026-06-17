import { handlePresentQueryResultPost } from '@/lib/agent/present-query-result-handler';

export async function POST(request: Request) {
  return handlePresentQueryResultPost(request);
}
