import Counter from '@/components/Counter';
import TodoList from '@/components/TodoList';
import Card from '@/components/basic/Card';
import McpTools from '@/components/McpTools';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Interactive Counter">
            <Counter />
          </Card>

          <Card title="Statistics">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Users
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  1,234
                </div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Active Sessions
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  567
                </div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page Views
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  8,901
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card title="MCP Tools">
            <McpTools />
          </Card>
        </div>

        <div className="mt-6">
          <TodoList />
        </div>
      </div>
    </div>
  );
}
