import Link from 'next/link'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Counter from '@/components/Counter'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to Turbo Monorepo
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Next.js 16 with custom server.ts and interactive components
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card title="Interactive Counter">
            <Counter />
          </Card>

          <Card title="Quick Links">
            <div className="space-y-3">
              <Link href="/about" className="block">
                <Button variant="primary" className="w-full">
                  About Us
                </Button>
              </Link>
              <Link href="/contact" className="block">
                <Button variant="secondary" className="w-full">
                  Contact
                </Button>
              </Link>
              <Link href="/dashboard" className="block">
                <Button variant="primary" className="w-full">
                  Dashboard
                </Button>
              </Link>
            </div>
          </Card>

          <Card title="Features">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Turbo Monorepo
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Next.js 16 App Router
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                TypeScript
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Custom Server
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Interactive UI Components
              </li>
            </ul>
          </Card>
        </div>

        <Card title="Getting Started">
          <p className="mb-4">
            This is a modern monorepo setup with Next.js 16, TypeScript, and Turbo.
            Explore the different pages and interactive components to see what's possible.
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button>Explore Dashboard</Button>
            </Link>
            <Link href="/about">
              <Button variant="secondary">Learn More</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
