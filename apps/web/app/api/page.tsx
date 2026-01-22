import UserManager from '@/components/UserManager'
import PostManager from '@/components/PostManager'

export default function ApiPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            API Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Interact with mock API endpoints using GET, POST, and DELETE requests
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <UserManager />
          </div>
          <div>
            <PostManager />
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Available API Endpoints
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                GET /api/users
              </code>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                - Get all users
              </span>
            </div>
            <div>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                POST /api/users
              </code>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                - Create a new user
              </span>
            </div>
            <div>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                DELETE /api/users/[id]
              </code>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                - Delete a user
              </span>
            </div>
            <div>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                GET /api/posts
              </code>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                - Get all posts
              </span>
            </div>
            <div>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                POST /api/posts
              </code>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                - Create a new post
              </span>
            </div>
            <div>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                DELETE /api/posts/[id]
              </code>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                - Delete a post
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
