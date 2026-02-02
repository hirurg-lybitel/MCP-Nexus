import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'MCP Nexus',
  description: 'MCP in Turbo monorepo',
  icons: {
    icon: [
      {
        url: '/logo/logo-light.svg',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/logo/logo-dark.svg',
        media: '(prefers-color-scheme: dark)',
      }
    ],
    apple: '/logo/apple-touch-icon.png'
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex flex-col min-h-screen bg-linear-to-b from-gray-950 via-gray-900 to-gray-950 text-gray-100">
          <Navigation />
          <main className="flex-1 pt-16">{children}</main>
        </div>
      </body>
    </html>
  );
}
