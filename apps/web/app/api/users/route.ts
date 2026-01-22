import { NextRequest, NextResponse } from 'next/server'
import { mockUsers, type User } from '@/lib/mockData'

// In-memory storage (resets on server restart)
// In production, this would be a database
let users: User[] = [...mockUsers]

// GET /api/users
export async function GET() {
  return NextResponse.json({ users, total: users.length })
}

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role = 'User' } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      name,
      email,
      role,
    }

    users.push(newUser)

    return NextResponse.json(
      { user: newUser, message: 'User created successfully' },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
