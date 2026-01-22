// API utility functions

const API_BASE = '/api'

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

// Users API
export async function getUsers(): Promise<{ users: User[]; total: number }> {
  const response = await fetch(`${API_BASE}/users`)
  if (!response.ok) {
    throw new Error('Failed to fetch users')
  }
  return response.json()
}

export async function createUser(user: {
  name: string
  email: string
  role?: string
}): Promise<{ user: User; message: string }> {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create user')
  }
  return response.json()
}

export async function deleteUser(id: number): Promise<{ user: User; message: string }> {
  const response = await fetch(`${API_BASE}/users/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete user')
  }
  return response.json()
}

// Posts API
export async function getPosts(): Promise<{ posts: Post[]; total: number }> {
  const response = await fetch(`${API_BASE}/posts`)
  if (!response.ok) {
    throw new Error('Failed to fetch posts')
  }
  return response.json()
}

export async function createPost(post: {
  title: string
  content: string
  author?: string
}): Promise<{ post: Post; message: string }> {
  const response = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(post),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create post')
  }
  return response.json()
}

export async function deletePost(id: number): Promise<{ post: Post; message: string }> {
  const response = await fetch(`${API_BASE}/posts/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete post')
  }
  return response.json()
}
