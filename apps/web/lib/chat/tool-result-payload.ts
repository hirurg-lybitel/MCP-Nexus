/**
 * Normalizes MCP tool responses for the OpenAI tool channel and UI table parser.
 * Prefers structuredContent (Claude Code pattern) over plain text blobs.
 */
export function toolResultPayload(response: unknown): string {
  if (typeof response === 'string') {
    return response;
  }

  if (!response || typeof response !== 'object') {
    return JSON.stringify(response);
  }

  const record = response as Record<string, unknown>;

  if (record.isError) {
    const text = extractMcpText(response);
    return text ?? JSON.stringify(record);
  }

  if (
    record.structuredContent != null &&
    typeof record.structuredContent === 'object'
  ) {
    return JSON.stringify(record.structuredContent);
  }

  const text = extractMcpText(response);
  if (text) {
    return text;
  }

  return JSON.stringify(response);
}

function extractMcpText(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const content = (response as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return null;
  }

  const parts = content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const itemRecord = item as Record<string, unknown>;
      if (itemRecord.type === 'text' && typeof itemRecord.text === 'string') {
        return itemRecord.text;
      }
      return null;
    })
    .filter((part): part is string => typeof part === 'string' && part.length > 0);

  return parts.length > 0 ? parts.join('\n') : null;
}
