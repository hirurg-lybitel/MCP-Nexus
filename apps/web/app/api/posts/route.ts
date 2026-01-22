import { NextRequest, NextResponse } from 'next/server'
import { mockPosts, type Post } from '@/lib/mockData'

// In-memory storage (resets on server restart)
// In production, this would be a database
let posts: Post[] = [...mockPosts]

// GET /api/posts
export async function GET() {
  return NextResponse.json({ posts, total: posts.length })
}

// POST /api/posts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, author = 'Anonymous' } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const newPost = {
      id: posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1,
      title,
      content,
      author,
      createdAt: new Date().toISOString(),
    }

    posts.push(newPost)

    return NextResponse.json(
      { post: newPost, message: 'Post created successfully' },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
