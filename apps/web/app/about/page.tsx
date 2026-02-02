'use client';

import Card from '@/components/basic/Card';
import Button from '@/components/basic/Button';
import Link from 'next/link';
import { useTokenStore } from '@/stores/useTokenStore';

export default function AboutPage() {
  const { token, setToken, clearToken } = useTokenStore();

  return (
    <div className="py-8 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-8">
          About Us
        </h1>
        
        <div className="space-y-6">
          <Card title="OpenAI Configuration">
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter your personal access token. It will be saved locally in your browser.
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

          <Card title="MCP-Nexus Project">
            <p className="mb-4 text-gray-300">
              This is a demonstration Next.js application showcasing a complete 
              <strong> Model Context Protocol (MCP) server</strong> implementation 
              with universal access from multiple sources:
            </p>
            <ul className="list-disc list-inside space-y-1.5 mb-4 text-gray-300">
              <li>External clients (Cursor, Claude Desktop, etc.)</li>
              <li>Client-side Next.js components</li>
              <li>Server-side API routes and Server Components</li>
            </ul>
            <p className="mb-4 text-gray-300">
              The project serves as a reference implementation for integrating 
              advanced AI capabilities via MCP into modern full-stack Next.js applications.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/hirurg-lybitel/MCP-Nexus"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button>
                  View on GitHub →
                </Button>
              </a>
              <a
                href="https://github.com/hirurg-lybitel/MCP-Nexus#readme"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">
                  Read README
                </Button>
              </a>
            </div>
          </Card>

          <Card title="Technology Stack">
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Next.js 16 - React framework with App Router</li>
              <li>TypeScript - Type-safe JavaScript</li>
              <li>Turbo - High-performance monorepo build system</li>
              <li>pnpm - Fast, disk space efficient package manager</li>
              <li>Tailwind CSS - Utility-first CSS framework</li>
            </ul>
          </Card>

          <Card title="Get Started">
            <p className="mb-4 text-gray-300">
              Ready to explore? Check out our interactive components and pages!
            </p>
            <div className="flex gap-3">
              <Link href="/chat">
                <Button>
                  Go to Chat
                </Button>
              </Link>
              <Link href="/">
                <Button variant="secondary">
                  Home
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
