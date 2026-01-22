'use client'

import { useState, useEffect } from 'react'
import { getPosts, createPost, deletePost, type Post } from '@/lib/api'
import Card from './Card'
import Button from './Button'

export default function PostManager() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '',
  })

  const loadPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPosts()
      setPosts(data.posts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      await createPost(formData)
      setFormData({ title: '', content: '', author: '' })
      setShowForm(false)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return
    }
    try {
      setError(null)
      await deletePost(id)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Card title="Post Management">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total posts: {posts.length}
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            {showForm ? 'Cancel' : 'Create Post'}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
            <div>
              <label htmlFor="post-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                id="post-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="post-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content
              </label>
              <textarea
                id="post-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="post-author" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Author (optional)
              </label>
              <input
                id="post-author"
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Anonymous"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <Button type="submit" className="w-full">Create Post</Button>
          </form>
        )}

        {loading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading posts...
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No posts found. Create one above!
          </div>
        )}
        {!loading && posts.length > 0 && (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <span>By: {post.author}</span>
                      <span>•</span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDelete(post.id)}
                    variant="danger"
                    size="sm"
                    className="ml-4"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
