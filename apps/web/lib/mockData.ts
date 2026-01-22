// Shared mock data storage
// Note: In production, this would be replaced with a database

export interface User {
  id: number
  name: string
  email: string
  role: string
}

export interface Post {
  id: number
  title: string
  content: string
  author: string
  createdAt: string
}

// In-memory storage (resets on server restart)
export const mockUsers: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
]

export const mockPosts: Post[] = [
  {
    id: 1,
    title: 'Getting Started with Next.js 16',
    content: 'Next.js 16 introduces many exciting features including improved performance, better TypeScript support, and enhanced developer experience.',
    author: 'John Doe',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    title: 'TypeScript Best Practices',
    content: 'TypeScript helps you write safer code by catching errors at compile time. Learn about type inference, generics, and advanced patterns.',
    author: 'Jane Smith',
    createdAt: '2024-01-14T14:30:00Z',
  },
  {
    id: 3,
    title: 'Turbo Monorepo Setup',
    content: 'Learn how to set up a Turbo monorepo for managing multiple packages and applications efficiently with shared dependencies.',
    author: 'Bob Johnson',
    createdAt: '2024-01-13T09:15:00Z',
  },
]
