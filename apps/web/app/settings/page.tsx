'use client';

import Button from '@/components/basic/Button';
import Card from '@/components/basic/Card';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useDeveloperModeStore } from '@/stores/useDeveloperModeStore';
import { useDomainContextStore } from '@/stores/useDomainContextStore';
import { useMcpKeyStore } from '@/stores/useMcpKeyStore';
import { useTokenStore } from '@/stores/useTokenStore';
import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';

export default function SettingsPage() {
  const { token, setToken, clearToken } = useTokenStore();
  const { developerMode, setDeveloperMode } = useDeveloperModeStore();
  const { domainContext, setDomainContext, clearDomainContext } =
    useDomainContextStore();
  const {
    mcpKey,
    isValidated,
    saveValidatedMcpKey,
    setValidated,
    clearMcpKey,
  } = useMcpKeyStore();

  const [mcpKeyInput, setMcpKeyInput] = useState(mcpKey);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);

  const handleVerifyMcpKey = useCallback(async () => {
    setMcpError(null);
    setMcpSaving(true);

    try {
      const response = await fetch('/api/settings/validate-mcp-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: mcpKeyInput }),
      });

      const data = (await response.json()) as {
        valid?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.valid) {
        setValidated(false);
        setMcpError(
          response.status === 401
            ? 'Invalid MCP access key.'
            : data.error ?? 'Failed to verify MCP access key.'
        );
        return;
      }

      saveValidatedMcpKey(mcpKeyInput);
    } catch {
      setValidated(false);
      setMcpError('Failed to verify MCP access key.');
    } finally {
      setMcpSaving(false);
    }
  }, [mcpKeyInput, saveValidatedMcpKey, setValidated]);

  const handleClearMcpKey = useCallback(() => {
    clearMcpKey();
    setMcpKeyInput('');
    setMcpError(null);
  }, [clearMcpKey]);

  return (
    <div className="py-8 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400 mb-8">
          Configure access keys for OpenAI chat and MCP server connections.
        </p>

        <div className="space-y-6">
          <Card title="OpenAI Configuration">
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter your personal access token for the GPT proxy. It is saved
                locally in your browser session.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter token (e.g. QgUSEaduJBT3B...)"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600"
                />
                {token && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={clearToken}
                    className="w-fit"
                  >
                    Remove token
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card title="MCP Access Key">
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter the MCP server access key to unlock database tools in the
                chat. The key is verified against the server and saved locally
                after a successful check.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={mcpKeyInput}
                  onChange={(e) => {
                    setMcpKeyInput(e.target.value);
                    setMcpError(null);
                    if (isValidated) {
                      setValidated(false);
                    }
                  }}
                  placeholder="Enter MCP API key"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handleVerifyMcpKey}
                    disabled={mcpSaving || !mcpKeyInput.trim()}
                  >
                    {mcpSaving ? 'Verifying…' : 'Verify and save'}
                  </Button>
                  {(mcpKey || isValidated) && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleClearMcpKey}
                    >
                      Remove key
                    </Button>
                  )}
                </div>
                {isValidated && (
                  <p className="text-sm text-green-400">
                    MCP access key verified successfully.
                  </p>
                )}
                {mcpError && (
                  <p className="text-sm text-red-400">{mcpError}</p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Domain context">
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Describe table relationships and business rules for the chat
                assistant. Saved locally in your browser and appended to the
                system prompt on every message in{' '}
                <Link href="/chat" className="text-blue-400 hover:underline">
                  Chat
                </Link>
                . Does not affect external MCP clients (e.g. Cursor).
              </p>
              <textarea
                value={domainContext}
                onChange={(e) => setDomainContext(e.target.value)}
                placeholder={
                  'Example:\n' +
                  '- GD_GOOD.GROUP_ID → GD_GROUP.ID (product category; GD_GROUP has PARENT_ID)\n' +
                  '- Use GD_REMAINS.QUANTITY for stock, not GD_GOOD'
                }
                rows={10}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600 resize-y min-h-[160px]"
              />
              <div className="flex flex-wrap items-center gap-3">
                <p
                  className={`text-sm ${
                    domainContext.length >= MAX_DOMAIN_CONTEXT_CHARS
                      ? 'text-amber-400'
                      : 'text-gray-500'
                  }`}
                >
                  {domainContext.length.toLocaleString()} /{' '}
                  {MAX_DOMAIN_CONTEXT_CHARS.toLocaleString()} characters
                </p>
                {domainContext && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={clearDomainContext}
                    className="w-fit"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card title="Developer">
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                When enabled, the chat shows collapsible &quot;Using:&quot;
                panels for each tool call (SQL input, summaries, and raw
                results). Tables, query plans, and assistant replies are always
                visible.
              </p>
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={developerMode}
                  onChange={(e) => setDeveloperMode(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-gray-200">Developer mode</span>
              </label>
            </div>
          </Card>

          <Card title="Navigation">
            <div className="flex flex-wrap gap-3">
              <Link href="/chat">
                <Button>Go to Chat</Button>
              </Link>
              <Link href="/about">
                <Button variant="secondary">About</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
