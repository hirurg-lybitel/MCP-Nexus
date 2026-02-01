'use client';

import Card from '@/components/basic/Card';
import Button from '@/components/basic/Button';
import Link from 'next/link';
import { useTokenStore } from '@/stores/useTokenStore';

export default function AboutPage() {
  const { token, setToken, clearToken } = useTokenStore();

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 py-8 text-gray-100">
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

          <Card title="Our Mission">
            <p className="mb-4 text-gray-300">
              We are building modern web applications using the latest technologies
              including Next.js 16, TypeScript, and Turbo monorepo architecture.
            </p>
            <p className="text-gray-300">
              Our goal is to create scalable, maintainable, and performant applications
              that provide excellent user experiences.
            </p>
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
