'use client';

import Card from '@/components/basic/Card';
import Button from '@/components/basic/Button';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="py-8 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-8">
          About Us
        </h1>
        
        <div className="space-y-6">
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
              Ready to explore? Configure your access keys in Settings, then try
              the interactive chat.
            </p>
            <div className="flex gap-3">
              <Link href="/settings">
                <Button>
                  Settings
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="secondary">
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
