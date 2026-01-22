import Card from '@/components/Card'
import Button from '@/components/Button'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          About Us
        </h1>
        
        <div className="space-y-6">
          <Card title="Our Mission">
            <p className="mb-4">
              We are building modern web applications using the latest technologies
              including Next.js 16, TypeScript, and Turbo monorepo architecture.
            </p>
            <p>
              Our goal is to create scalable, maintainable, and performant applications
              that provide excellent user experiences.
            </p>
          </Card>

          <Card title="Technology Stack">
            <ul className="list-disc list-inside space-y-2">
              <li>Next.js 16 - React framework with App Router</li>
              <li>TypeScript - Type-safe JavaScript</li>
              <li>Turbo - High-performance monorepo build system</li>
              <li>pnpm - Fast, disk space efficient package manager</li>
              <li>Tailwind CSS - Utility-first CSS framework</li>
            </ul>
          </Card>

          <Card title="Get Started">
            <p className="mb-4">
              Ready to explore? Check out our interactive components and pages!
            </p>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
              <Link href="/contact">
                <Button variant="secondary">Contact Us</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
