// @ts-nocheck
// Next.js page component - requires Next.js environment to run

// frontend/pages/dashboard/today.tsx
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
// In production, these would come from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Define Task interface
interface Task {
  id: string
  type: string
  related_id: string  // application_id
  due_at: string
  status: string
  title?: string
  description?: string
  created_at: string
}

export default function TodayTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch today's tasks
  useEffect(() => {
    fetchTodayTasks()
  }, [])

  const fetchTodayTasks = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get start and end of today
      const today = new Date()
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()

      // Query tasks due today that are not completed
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_at', startOfDay)
        .lte('due_at', endOfDay)
        .neq('status', 'completed')
        .order('due_at', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      setTasks(data || [])
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  // Mark task as complete
  const markComplete = async (taskId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId)

      if (updateError) {
        throw updateError
      }

      // Update local state
      setTasks(tasks.filter(task => task.id !== taskId))
      
      // Show success message (optional)
      alert('Task marked as complete!')
    } catch (err) {
      console.error('Error updating task:', err)
      alert('Failed to mark task as complete')
    }
  }

  // Format date for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Get badge color based on task type
  const getTaskTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-blue-100 text-blue-800'
      case 'email':
        return 'bg-green-100 text-green-800'
      case 'review':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Today's Tasks</h1>
          <p className="text-gray-600 mt-2">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading tasks...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Tasks List */}
        {!loading && !error && (
          <>
            {tasks.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  All caught up!
                </h2>
                <p className="text-gray-600">
                  You have no pending tasks for today.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                  >
                    <div className="flex items-start justify-between">
                      {/* Task Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {/* Task Type Badge */}
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getTaskTypeBadgeColor(
                              task.type
                            )}`}
                          >
                            {task.type.toUpperCase()}
                          </span>

                          {/* Due Time */}
                          <span className="text-sm text-gray-500">
                            Due: {formatTime(task.due_at)}
                          </span>

                          {/* Status Badge */}
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                            {task.status}
                          </span>
                        </div>

                        {/* Task Title */}
                        {task.title && (
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {task.title}
                          </h3>
                        )}

                        {/* Task Description */}
                        {task.description && (
                          <p className="text-gray-600 mb-3">{task.description}</p>
                        )}

                        {/* Application ID */}
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">Application ID:</span>{' '}
                          <code className="bg-gray-100 px-2 py-1 rounded">
                            {task.related_id}
                          </code>
                        </div>
                      </div>

                      {/* Mark Complete Button */}
                      <button
                        onClick={() => markComplete(task.id)}
                        className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200"
                      >
                        Mark Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Task Count */}
            {tasks.length > 0 && (
              <div className="mt-6 text-center text-gray-600">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} remaining today
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}